// parserAdapter.js - CommonJS adapter for parser.js
const fs = require('fs');
const path = require('path');

// Create a Parser class and expose it directly (not as an object property)
class Parser {
  /**
   * Parse raw HL7 message text into JSON structure.
   * @param {string} text - Raw HL7 message string
   * @returns {Object<string, Array<Array<string>>>} - Parsed segments
   */
  parse(text) {
    // Split into non-empty lines
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    const message = {};

    for (const line of lines) {
      const [segment, ...fields] = line.split('|');
      if (!message[segment]) {
        message[segment] = [];
      }
      message[segment].push(fields);
    }
    return message;
  }
}

// Export the Parser class directly
module.exports = Parser;
