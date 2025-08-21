/**
 * Smart Model Selector for China Users
 */

const logger = require('../utils/logger');

class SmartModelSelector {
  constructor() {
    this.chinaIPRanges = [
      { start: '1.0.0.0', end: '1.255.255.255' },
      { start: '14.0.0.0', end: '14.255.255.255' },
      { start: '27.0.0.0', end: '27.255.255.255' },
      { start: '36.0.0.0', end: '36.255.255.255' },
      { start: '39.0.0.0', end: '39.255.255.255' },
      { start: '42.0.0.0', end: '42.255.255.255' },
      { start: '49.0.0.0', end: '49.255.255.255' },
      { start: '58.0.0.0', end: '58.255.255.255' },
      { start: '59.0.0.0', end: '59.255.255.255' },
      { start: '60.0.0.0', end: '60.255.255.255' },
      { start: '61.0.0.0', end: '61.255.255.255' },
      { start: '101.0.0.0', end: '101.255.255.255' },
      { start: '103.0.0.0', end: '103.255.255.255' },
      { start: '106.0.0.0', end: '106.255.255.255' },
      { start: '110.0.0.0', end: '110.255.255.255' },
      { start: '111.0.0.0', end: '111.255.255.255' },
      { start: '112.0.0.0', end: '112.255.255.255' },
      { start: '113.0.0.0', end: '113.255.255.255' },
      { start: '114.0.0.0', end: '114.255.255.255' },
      { start: '115.0.0.0', end: '115.255.255.255' },
      { start: '116.0.0.0', end: '116.255.255.255' },
      { start: '117.0.0.0', end: '117.255.255.255' },
      { start: '118.0.0.0', end: '118.255.255.255' },
      { start: '119.0.0.0', end: '119.255.255.255' },
      { start: '120.0.0.0', end: '120.255.255.255' },
      { start: '121.0.0.0', end: '121.255.255.255' },
      { start: '122.0.0.0', end: '122.255.255.255' },
      { start: '123.0.0.0', end: '123.255.255.255' },
      { start: '124.0.0.0', end: '124.255.255.255' },
      { start: '125.0.0.0', end: '125.255.255.255' },
      { start: '126.0.0.0', end: '126.255.255.255' },
      { start: '175.0.0.0', end: '175.255.255.255' },
      { start: '180.0.0.0', end: '180.255.255.255' },
      { start: '182.0.0.0', end: '182.255.255.255' },
      { start: '183.0.0.0', end: '183.255.255.255' },
      { start: '202.0.0.0', end: '202.255.255.255' },
      { start: '203.0.0.0', end: '203.255.255.255' },
      { start: '210.0.0.0', end: '210.255.255.255' },
      { start: '211.0.0.0', end: '211.255.255.255' },
      { start: '218.0.0.0', end: '218.255.255.255' },
      { start: '219.0.0.0', end: '219.255.255.255' },
      { start: '220.0.0.0', end: '220.255.255.255' },
      { start: '221.0.0.0', end: '221.255.255.255' },
      { start: '222.0.0.0', end: '222.255.255.255' },
      { start: '223.0.0.0', end: '223.255.255.255' }
    ];
  }

  ipToNumber(ip) {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  }

  isChinaIP(ip) {
    const ipNum = this.ipToNumber(ip);
    return this.chinaIPRanges.some(range => {
      const startNum = this.ipToNumber(range.start);
      const endNum = this.ipToNumber(range.end);
      return ipNum >= startNum && ipNum <= endNum;
    });
  }

  selectBestModel(userIP, messageLength = 0) {
    const isChina = this.isChinaIP(userIP);
    logger.info(`User IP: ${userIP}, Location: ${isChina ? 'China' : 'Global'}`);

    // For China users, prioritize fastest models
    if (isChina) {
      // Ultra-fast models for China
      if (messageLength < 100) {
        return {
          modelId: 'llama3-8b-8192',
          modelName: 'Llama 3 8B',
          provider: 'Groq Models',
          speed: 'ultra-fast',
          contextWindow: 8192,
          reason: 'China user, short message - ultra-fast response'
        };
      } else {
        return {
          modelId: 'llama3-70b-8192',
          modelName: 'Llama 3 70B',
          provider: 'Groq Models',
          speed: 'fast',
          contextWindow: 8192,
          reason: 'China user, longer message - high quality response'
        };
      }
    } else {
      // Global users - balanced approach
      return {
        modelId: 'gemini-1.5-flash',
        modelName: 'Gemini 1.5 Flash',
        provider: 'Google AI Models',
        speed: 'fast',
        contextWindow: 8192,
        reason: 'Global user - balanced speed and quality'
      };
    }
  }
}

module.exports = new SmartModelSelector();
