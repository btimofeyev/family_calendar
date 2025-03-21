// src/services/index.js
const notificationCleanupService = require('./notificationCleanupService');

/**
 * Service manager to initialize and manage all services
 */
class ServiceManager {
  constructor() {
    this.services = {
      notificationCleanup: notificationCleanupService
    };
    this.isInitialized = false;
  }

  /**
   * Initialize all services
   * @param {Object} options - Service-specific options
   */
  initialize(options = {}) {
    if (this.isInitialized) {
      console.log('Services already initialized');
      return;
    }

    console.log('Initializing services...');

    // Initialize notification cleanup service
    const notificationCleanupOptions = options.notificationCleanup || {};
    this.services.notificationCleanup.initialize(notificationCleanupOptions);

    // Initialize other services here as needed
    // ...

    this.isInitialized = true;
    console.log('All services initialized successfully');
  }

  /**
   * Stop all services
   */
  stopAll() {
    console.log('Stopping all services...');
    
    // Stop notification cleanup service
    this.services.notificationCleanup.stop();
    
    // Stop other services here as needed
    // ...
    
    this.isInitialized = false;
    console.log('All services stopped');
  }

  /**
   * Get a specific service
   * @param {string} serviceName - Name of the service to get
   * @returns {Object} Service instance
   */
  getService(serviceName) {
    if (!this.services[serviceName]) {
      throw new Error(`Service '${serviceName}' not found`);
    }
    return this.services[serviceName];
  }
}

// Export a singleton instance
const serviceManager = new ServiceManager();

module.exports = serviceManager;