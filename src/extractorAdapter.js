// extractorAdapter.js - CommonJS adapter for extractor.js
const fs = require('fs');
const path = require('path');
class Extractor {
  /**
   * Extract indexable fields from parsed HL7 object
   * @param {Object<string, Array<string[]>>} message - Parsed HL7 segments
   * @param {string} rawHl7 - Raw HL7 message text
   * @returns {Object} document - Partial Mongo document
   */
  extract(message, rawHl7) {
    const msh = message.MSH?.[0] || [];
    const pid = message.PID?.[0] || [];
    const [msgType, evtType] = msh[7]?.split('^') || [];
    let doc;
    // Route to specific mappers
    switch (`${msgType}_${evtType}`) {
      case 'ADT_A01':
        doc = this.mapAdtA01(msh, pid);
        break;
      case 'ORM_O01':
        doc = this.mapOrmO01(msh, pid, message);
        break;
      case 'ORU_R01':
        doc = this.mapOruR01(msh, pid, message);
        break;
      default:
        doc = this.mapDefault(msh, pid);
    }
    // Include raw HL7 message in every document
    doc.raw = rawHl7;
    return doc;
  }

  // Map ADT^A01 messages
  mapAdtA01(msh, pid) {
    const [lastName, firstName] = (pid[4] || '').split('^');
    return {
      messageType: msh[7]?.split('^')[0] || null,
      eventType:   msh[7]?.split('^')[1] || null,
      controlId:   msh[8] || null,
      sending:     { application: msh[1] || null, facility: msh[2] || null },
      receiving:   { application: msh[3] || null, facility: msh[4] || null },
      timestamp:   msh[5]
        ? new Date(`${msh[5].slice(0,4)}-${msh[5].slice(4,6)}-${msh[5].slice(6,8)}`)
        : null,
      patient: {
        id:        pid[2] || null,
        name:      pid[4] || null,
        firstName: firstName || null,
        lastName:  lastName || null,
        dob:       pid[6]
          ? new Date(`${pid[6].slice(0,4)}-${pid[6].slice(4,6)}-${pid[6].slice(6,8)}`)
          : null
      },
      orders:       [],
      observations: [],
      schedule:     null,
      processedAt:  new Date()
    };
  }

  // Map ORM^O01 messages
  mapOrmO01(msh, pid, message) {
    const orders = (message.ORC || message.OBR || []).map(fields => ({
      orderNumber: fields[1] || null,
      placerOrder: fields[2] || null
    }));

    const [lastName, firstName] = (pid[4] || '').split('^');
    return {
      messageType: msh[7]?.split('^')[0] || null,
      eventType:   msh[7]?.split('^')[1] || null,
      controlId:   msh[8] || null,
      sending:     { application: msh[1] || null, facility: msh[2] || null },
      receiving:   { application: msh[3] || null, facility: msh[4] || null },
      timestamp:   msh[5]
        ? new Date(`${msh[5].slice(0,4)}-${msh[5].slice(4,6)}-${msh[5].slice(6,8)}`)
        : null,
      patient: {
        id:        pid[2] || null,
        name:      pid[4] || null,
        firstName: firstName || null,
        lastName:  lastName || null,
        dob:       pid[6]
          ? new Date(`${pid[6].slice(0,4)}-${pid[6].slice(4,6)}-${pid[6].slice(6,8)}`)
          : null
      },
      orders,
      observations: [],
      schedule:     null,
      processedAt: new Date()
    };
  }

  // Map ORU^R01 messages
  mapOruR01(msh, pid, message) {
    // Map full OBR segments and preserve raw fields
    const orders = (message.OBR || []).map(fields => {
      const [ , setId, placerOrder, fillerOrder, rawService, ...rest] = fields;
      const [serviceCode, serviceText, serviceSystem] = rawService?.split('^') || [];
      return { setId: setId || null, placerOrder: placerOrder || null, fillerOrder: fillerOrder || null,
        service: { serviceCode: serviceCode || null, serviceText: serviceText || null, serviceSystem: serviceSystem || null },
        rest, raw: fields };
    });
    const observations = (message.OBX || []).map(fields => {
      const [,, rawCode] = fields;
      const [code] = rawCode?.split('^') || [];
      const rawValue = fields[4] || null;
      let value = rawValue;
      if (fields[1] === 'NM' && rawValue != null) {
        const n = Number(rawValue);
        value = isNaN(n) ? rawValue : n;
      }
      const units = fields[5] || null;
      return { code, value, units };
    });
    // Group observations by code into a single entry
    const groupedObservations = Object.values(
      observations.reduce((acc, obs) => {
        if (!acc[obs.code]) {
          acc[obs.code] = { code: obs.code, values: [], units: obs.units };
        }
        acc[obs.code].values.push(obs.value);
        return acc;
      }, {})
    );
    // Extract IMPRESSIONS OBX segments by code identifier “&IMP”
    const impressions = (message.OBX || [])
      .filter(fields => (fields[2] || '').toUpperCase() === '&IMP')
      .map(fields => fields[4] || null);
    
    // Define reportable terms from the image
    const reportableTerms = [
      'apparent', 'apparently',
      'appears',
      'comparable with',
      'compatible with',
      'consistent with',
      'favor', 'favors',
      'malignant appearing',
      'most likely',
      'presumed',
      'probable',
      'suspect', 'suspected',
      'suspicious', 'suspicious for',
      'typical of'
    ];
    
    const text = impressions.filter(Boolean).join(' ').toLowerCase();
    
    // Find which reportable terms appear in the impressions
    const foundTerms = reportableTerms.filter(term => text.includes(term));
    
    const tumorRegistry = {
      met: foundTerms.length > 0, // Flag as reportable if any term is found
      foundTerms
    };
    const sch = message.SCH?.[0] || [];
    const schedule = sch.length
      ? {
          id:        sch[1] || null,
          startTime: sch[7]
            ? new Date(`${sch[7].slice(0,4)}-${sch[7].slice(4,6)}-${sch[7].slice(6,8)}T${sch[8]}Z`)
            : null,
          endTime:   sch[9]
            ? new Date(`${sch[9].slice(0,4)}-${sch[9].slice(4,6)}-${sch[9].slice(6,8)}T${sch[10]}Z`)
            : null
        }
      : null;
    // Extract MRN (PID-17) and ordering provider from ORC segment
    const mrn = pid[17] || null;
    const orcSegment = message.ORC?.[0] || [];
    const rawProvider = orcSegment[11] || '';
    const [providerId, providerLast, providerFirst] = rawProvider.split('^') || [];
    const provider = providerLast && providerFirst ? { id: providerId, lastName: providerLast, firstName: providerFirst } : null;

    const [lastName, firstName] = (pid[4] || '').split('^');
    return {
      messageType: msh[7]?.split('^')[0] || null,
      eventType:   msh[7]?.split('^')[1] || null,
      controlId:   msh[8] || null,
      sending:     { application: msh[1] || null, facility: msh[2] || null },
      receiving:   { application: msh[3] || null, facility: msh[4] || null },
      timestamp:   msh[5]
        ? new Date(`${msh[5].slice(0,4)}-${msh[5].slice(4,6)}-${msh[5].slice(6,8)}`)
        : null,
      patient: {
        id:        pid[2] || null,
        name:      pid[4] || null,
        firstName: firstName || null,
        lastName:  lastName || null,
        mrn,    // added MRN
        dob:       pid[6]
          ? new Date(`${pid[6].slice(0,4)}-${pid[6].slice(4,6)}-${pid[6].slice(6,8)}`)
          : null,
        gender:    pid[7] || null
      },
      provider,  // added provider object
      orders,
      observations: groupedObservations,
      schedule,
      impressions,
      tumorRegistry,
      processedAt: new Date()
    };
  }

  // Fallback for other message types
  mapDefault(msh, pid) {
    const [lastName, firstName] = (pid[4] || '').split('^');
    return {
      messageType: msh[7]?.split('^')[0] || null,
      eventType:   msh[7]?.split('^')[1] || null,
      controlId:   msh[8] || null,
      sending:     { application: msh[1] || null, facility: msh[2] || null },
      receiving:   { application: msh[3] || null, facility: msh[4] || null },
      timestamp:   msh[5]
        ? new Date(`${msh[5].slice(0,4)}-${msh[5].slice(4,6)}-${msh[5].slice(6,8)}`)
        : null,
      patient: {
        id:        pid[2] || null,
        name:      pid[4] || null,
        firstName: firstName || null,
        lastName:  lastName || null,
        dob:       pid[6]
          ? new Date(`${pid[6].slice(0,4)}-${pid[6].slice(4,6)}-${pid[6].slice(6,8)}`)
          : null
      },
      orders:       [],
      observations: [],
      schedule:     null,
      processedAt:  new Date()
    };
  }
}

// Export the Extractor class directly
module.exports = Extractor;
