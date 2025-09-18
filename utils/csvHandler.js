const fs = require('fs-extra');
const path = require('path');
const csvParser = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { v4: uuidv4 } = require('uuid');

class CSVHandler {
    constructor() {
        this.dbPath = path.join(__dirname, '../db');
        this.serialConfigPath = path.join(this.dbPath, 'serial_configs.csv');
        this.ipConfigPath = path.join(this.dbPath, 'ip_configs.csv');
        this.initializeDatabase();
    }

    async initializeDatabase() {
        try {
            await fs.ensureDir(this.dbPath);
            
            // Initialize serial configs CSV with header if not exists
            if (!await fs.pathExists(this.serialConfigPath)) {
                await this.writeSerialConfigs([]);
                console.log('Created new serial_configs.csv');
            }

            // Initialize IP configs CSV with header if not exists
            if (!await fs.pathExists(this.ipConfigPath)) {
                await this.writeIpConfigs([]);
                console.log('Created new ip_configs.csv');
            }

            // Debug: Check if files exist and their content
            const serialExists = await fs.pathExists(this.serialConfigPath);
            const ipExists = await fs.pathExists(this.ipConfigPath);
            
            console.log('CSV Database initialized');
            console.log(`Serial CSV exists: ${serialExists}`);
            console.log(`IP CSV exists: ${ipExists}`);
            
            if (serialExists) {
                const serialContent = await fs.readFile(this.serialConfigPath, 'utf8');
                console.log('Serial CSV content preview:', serialContent.substring(0, 200));
            }
            
        } catch (error) {
            console.error('Error initializing database:', error);
        }
    }

    // Helper methods for parsing
    parseNumber(value, defaultValue = 0) {
        if (!value) return defaultValue;
        const parsed = parseInt(value.toString().trim());
        return isNaN(parsed) ? defaultValue : parsed;
    }

    parseBoolean(value) {
        if (!value) return false;
        const str = value.toString().toLowerCase().trim();
        return str === 'true' || str === '1' || str === 'yes';
    }

    // Serial Config Methods - UPDATED FOR TCP
    async getSerialConfigs() {
        return new Promise(async (resolve, reject) => {
            try {
                const configs = [];
                
                // Check if file exists
                if (!await fs.pathExists(this.serialConfigPath)) {
                    console.log('Serial configs file does not exist, returning empty array');
                    resolve([]);
                    return;
                }

                // Check if file is empty
                const stats = await fs.stat(this.serialConfigPath);
                if (stats.size === 0) {
                    console.log('Serial configs file is empty, returning empty array');
                    resolve([]);
                    return;
                }

                // Read and log file content for debugging
                const fileContent = await fs.readFile(this.serialConfigPath, 'utf8');
                console.log('Reading serial configs file...');
                console.log('File size:', stats.size);
                console.log('File content:', fileContent);

                // Parse CSV
                const stream = fs.createReadStream(this.serialConfigPath);
                let rowCount = 0;
                
                stream
                    .pipe(csvParser({
                        // Handle different header formats with TCP mapping
                        mapHeaders: ({ header, index }) => {
                            // Normalize headers
                            const normalized = header.toLowerCase().trim();
                            const headerMap = {
                                'id': 'id',
                                'name': 'name', 
                                'serial_port': 'serialPort',
                                'serialport': 'serialPort',
                                'baud_rate': 'baudRate',
                                'baudrate': 'baudRate',
                                // TCP mappings (new)
                                'tcp_out_host': 'tcpOutHost',
                                'tcpouthost': 'tcpOutHost',
                                'tcp_out_port': 'tcpOutPort',
                                'tcpoutport': 'tcpOutPort',
                                // UDP backward compatibility (legacy)
                                'udp_out_host': 'tcpOutHost',
                                'udpouthost': 'tcpOutHost',
                                'udp_out_port': 'tcpOutPort',
                                'udpoutport': 'tcpOutPort',
                                // Other fields
                                'created_at': 'createdAt',
                                'createdat': 'createdAt',
                                'active': 'active'
                            };
                            
                            const mappedHeader = headerMap[normalized] || header;
                            console.log(`Mapping header "${header}" -> "${mappedHeader}"`);
                            return mappedHeader;
                        },
                        skipEmptyLines: true,
                        skipLinesWithError: true
                    }))
                    .on('data', (row) => {
                        rowCount++;
                        console.log(`Processing row ${rowCount}:`, row);
                        
                        // Validate required fields
                        if (row.id && row.id.trim()) {
                            const config = {
                                id: row.id.trim(),
                                name: row.name || `Config ${rowCount}`,
                                serialPort: row.serialPort || '',
                                baudRate: this.parseNumber(row.baudRate, 9600),
                                tcpOutHost: row.tcpOutHost || '127.0.0.1',  // CHANGED TO TCP
                                tcpOutPort: this.parseNumber(row.tcpOutPort, 4001),  // CHANGED TO TCP with port 4001
                                createdAt: row.createdAt || new Date().toISOString(),
                                active: this.parseBoolean(row.active)
                            };
                            
                            console.log(`Adding config:`, config);
                            configs.push(config);
                        } else {
                            console.log(`Skipping row ${rowCount} - no valid ID:`, row);
                        }
                    })
                    .on('end', () => {
                        console.log(`Finished parsing serial configs. Total rows: ${rowCount}, Valid configs: ${configs.length}`);
                        resolve(configs);
                    })
                    .on('error', (error) => {
                        console.error('Error parsing serial configs CSV:', error);
                        reject(error);
                    });
                    
            } catch (error) {
                console.error('Error in getSerialConfigs:', error);
                reject(error);
            }
        });
    }

    async saveSerialConfig(config) {
        try {
            console.log('Saving serial config:', config);
            
            // Get existing configs
            const configs = await this.getSerialConfigs();
            console.log('Existing configs count:', configs.length);
            
            const newConfig = {
                id: config.id || uuidv4(),
                name: config.name || 'Unnamed Configuration',
                serialPort: config.serialPort || '',
                baudRate: this.parseNumber(config.baudRate, 9600),
                tcpOutHost: config.tcpOutHost || '127.0.0.1',  // CHANGED TO TCP
                tcpOutPort: this.parseNumber(config.tcpOutPort, 4001),  // CHANGED TO TCP
                createdAt: config.createdAt || new Date().toISOString(),
                active: config.active || false
            };

            console.log('Processed config:', newConfig);

            const existingIndex = configs.findIndex(c => c.id === newConfig.id);
            if (existingIndex !== -1) {
                console.log('Updating existing config at index:', existingIndex);
                configs[existingIndex] = newConfig;
            } else {
                console.log('Adding new config');
                configs.push(newConfig);
            }

            await this.writeSerialConfigs(configs);
            console.log('Config saved successfully');
            
            // Verify save by reading back
            const verifyConfigs = await this.getSerialConfigs();
            console.log('Verification - configs count after save:', verifyConfigs.length);
            
            return newConfig;
        } catch (error) {
            console.error('Error saving serial config:', error);
            throw new Error('Failed to save serial config: ' + error.message);
        }
    }

    async deleteSerialConfig(id) {
        try {
            console.log('Deleting serial config with ID:', id);
            
            const configs = await this.getSerialConfigs();
            console.log('Configs before delete:', configs.length);
            
            const originalLength = configs.length;
            const filteredConfigs = configs.filter(c => {
                const keep = c.id !== id;
                if (!keep) {
                    console.log('Removing config:', c);
                }
                return keep;
            });
            
            if (filteredConfigs.length === originalLength) {
                throw new Error('Configuration not found');
            }
            
            await this.writeSerialConfigs(filteredConfigs);
            console.log(`Deleted serial config. Remaining configs: ${filteredConfigs.length}`);
            
            return true;
        } catch (error) {
            console.error('Error deleting serial config:', error);
            throw new Error('Failed to delete serial config: ' + error.message);
        }
    }

    // FIXED: writeSerialConfigs for TCP output
    async writeSerialConfigs(configs) {
        try {
            console.log(`Writing ${configs.length} serial configs to CSV`);
            
            await fs.ensureDir(this.dbPath);
            
            const csvWriter = createCsvWriter({
                path: this.serialConfigPath,
                header: [
                    { id: 'id', title: 'ID' },
                    { id: 'name', title: 'NAME' },
                    { id: 'serialPort', title: 'SERIAL_PORT' },
                    { id: 'baudRate', title: 'BAUD_RATE' },
                    { id: 'tcpOutHost', title: 'TCP_OUT_HOST' },    // CHANGED FROM UDP
                    { id: 'tcpOutPort', title: 'TCP_OUT_PORT' },    // CHANGED FROM UDP
                    { id: 'createdAt', title: 'CREATED_AT' },
                    { id: 'active', title: 'ACTIVE' }
                ]
            });
            
            await csvWriter.writeRecords(configs);
            
            // Verify write
            const fileContent = await fs.readFile(this.serialConfigPath, 'utf8');
            console.log('File written. Content preview:', fileContent.substring(0, 300));
            
            console.log(`Successfully wrote ${configs.length} serial configs to CSV`);
        } catch (error) {
            console.error('Error writing serial configs:', error);
            throw error;
        }
    }

    // IP Config Methods - UPDATED FOR TCP
 async getIpConfigs() {
    return new Promise(async (resolve, reject) => {
        try {
            const configs = [];
            
            if (!await fs.pathExists(this.ipConfigPath)) {
                console.log('IP configs file does not exist, returning empty array');
                resolve([]);
                return;
            }

            const stats = await fs.stat(this.ipConfigPath);
            if (stats.size === 0) {
                console.log('IP configs file is empty, returning empty array');
                resolve([]);
                return;
            }

            const stream = fs.createReadStream(this.ipConfigPath);
            let rowCount = 0;
            
            stream
                .pipe(csvParser({
                    mapHeaders: ({ header, index }) => {
                        const normalized = header.toLowerCase().trim();
                        const headerMap = {
                            'id': 'id',
                            'name': 'name',
                            'ip_host': 'ipHost',
                            'iphost': 'ipHost',
                            'ip_port': 'ipPort',
                            'ipport': 'ipPort',
                            'connection_mode': 'connectionMode',
                            'connectionmode': 'connectionMode',
                            // TCP mappings (new)
                            'tcp_out_host': 'tcpOutHost',
                            'tcpouthost': 'tcpOutHost',
                            'tcp_out_port': 'tcpOutPort',
                            'tcpoutport': 'tcpOutPort',
                            // UDP backward compatibility (legacy)
                            'udp_out_host': 'tcpOutHost',
                            'udpouthost': 'tcpOutHost',
                            'udp_out_port': 'tcpOutPort',
                            'udpoutport': 'tcpOutPort',
                            // Other fields
                            'created_at': 'createdAt',
                            'createdat': 'createdAt',
                            'active': 'active'
                        };
                        
                        return headerMap[normalized] || header;
                    },
                    skipEmptyLines: true,
                    skipLinesWithError: true
                }))
                .on('data', (row) => {
                    rowCount++;
                    console.log(`Processing IP row ${rowCount}:`, row);
                    
                    if (row.id && row.id.trim()) {
                        const config = {
                            id: row.id.trim(),
                            name: row.name || `IP Config ${rowCount}`,
                            ipHost: row.ipHost || '127.0.0.1',
                            ipPort: this.parseNumber(row.ipPort, 3001),
                            connectionMode: row.connectionMode || 'server', // PENTING: Default value
                            tcpOutHost: row.tcpOutHost || '127.0.0.1',  // CHANGED TO TCP
                            tcpOutPort: this.parseNumber(row.tcpOutPort, 4001),  // CHANGED TO TCP
                            createdAt: row.createdAt || new Date().toISOString(),
                            active: this.parseBoolean(row.active)
                        };
                        
                        console.log(`Adding IP config:`, config);
                        configs.push(config);
                    } else {
                        console.log(`Skipping IP row ${rowCount} - no valid ID:`, row);
                    }
                })
                .on('end', () => {
                    console.log(`Finished parsing IP configs. Total rows: ${rowCount}, Valid configs: ${configs.length}`);
                    resolve(configs);
                })
                .on('error', (error) => {
                    console.error('Error parsing IP configs CSV:', error);
                    reject(error);
                });
                
        } catch (error) {
            console.error('Error in getIpConfigs:', error);
            reject(error);
        }
    });
}


  async saveIpConfig(config) {
    try {
        console.log('Saving IP config:', config);
        
        const configs = await this.getIpConfigs();
        console.log('Existing IP configs count:', configs.length);
        
        const newConfig = {
            id: config.id || uuidv4(),
            name: config.name || 'Unnamed Configuration',
            ipHost: config.ipHost || '127.0.0.1',
            ipPort: this.parseNumber(config.ipPort, 3001),
            connectionMode: config.connectionMode || 'server', // PENTING: Default value
            tcpOutHost: config.tcpOutHost || '127.0.0.1',     // CHANGED FROM udpOutHost
            tcpOutPort: this.parseNumber(config.tcpOutPort, 4001), // CHANGED FROM udpOutPort  
            createdAt: config.createdAt || new Date().toISOString(),
            active: config.active || false
        };

        console.log('Processed IP config:', newConfig);

        const existingIndex = configs.findIndex(c => c.id === newConfig.id);
        if (existingIndex !== -1) {
            console.log('Updating existing IP config at index:', existingIndex);
            configs[existingIndex] = newConfig;
        } else {
            console.log('Adding new IP config');
            configs.push(newConfig);
        }

        await this.writeIpConfigs(configs);
        console.log('IP config saved successfully');
        
        return newConfig;
    } catch (error) {
        console.error('Error saving IP config:', error);
        throw new Error('Failed to save IP config: ' + error.message);
    }
}


    async deleteIpConfig(id) {
        try {
            console.log('Deleting IP config with ID:', id);
            
            const configs = await this.getIpConfigs();
            console.log('IP configs before delete:', configs.length);
            
            const originalLength = configs.length;
            const filteredConfigs = configs.filter(c => {
                const keep = c.id !== id;
                if (!keep) {
                    console.log('Removing IP config:', c);
                }
                return keep;
            });
            
            if (filteredConfigs.length === originalLength) {
                throw new Error('Configuration not found');
            }
            
            await this.writeIpConfigs(filteredConfigs);
            console.log(`Deleted IP config. Remaining configs: ${filteredConfigs.length}`);
            
            return true;
        } catch (error) {
            console.error('Error deleting IP config:', error);
            throw new Error('Failed to delete IP config: ' + error.message);
        }
    }

    // FIXED: writeIpConfigs for TCP output
    async writeIpConfigs(configs) {
        try {
            console.log(`Writing ${configs.length} IP configs to CSV`);
            
            await fs.ensureDir(this.dbPath);
            
            const csvWriter = createCsvWriter({
                path: this.ipConfigPath,
                header: [
                    { id: 'id', title: 'ID' },
                    { id: 'name', title: 'NAME' },
                    { id: 'ipHost', title: 'IP_HOST' },
                    { id: 'ipPort', title: 'IP_PORT' },
                    { id: 'connectionMode', title: 'CONNECTION_MODE' },
                    { id: 'tcpOutHost', title: 'TCP_OUT_HOST' },    // CHANGED FROM UDP
                    { id: 'tcpOutPort', title: 'TCP_OUT_PORT' },    // CHANGED FROM UDP
                    { id: 'createdAt', title: 'CREATED_AT' },
                    { id: 'active', title: 'ACTIVE' }
                ]
            });
            
            await csvWriter.writeRecords(configs);
            
            // Verify write
            const fileContent = await fs.readFile(this.ipConfigPath, 'utf8');
            console.log('IP file written. Content preview:', fileContent.substring(0, 300));
            
            console.log(`Successfully wrote ${configs.length} IP configs to CSV`);
        } catch (error) {
            console.error('Error writing IP configs:', error);
            throw error;
        }
    }

    async setActiveConfig(type, id) {
        try {
            console.log(`Setting active config: ${type} - ${id}`);
            
            if (type === 'serial') {
                const configs = await this.getSerialConfigs();
                configs.forEach(c => c.active = c.id === id);
                await this.writeSerialConfigs(configs);
            } else if (type === 'ip') {
                const configs = await this.getIpConfigs();
                configs.forEach(c => c.active = c.id === id);
                await this.writeIpConfigs(configs);
            }
            
            console.log(`Set active config successfully`);
            return true;
        } catch (error) {
            console.error('Error setting active config:', error);
            throw new Error('Failed to set active config: ' + error.message);
        }
    }

    async clearActiveConfigs() {
        try {
            console.log('Clearing all active configs');
            
            const serialConfigs = await this.getSerialConfigs();
            const ipConfigs = await this.getIpConfigs();
            
            serialConfigs.forEach(c => c.active = false);
            ipConfigs.forEach(c => c.active = false);
            
            await this.writeSerialConfigs(serialConfigs);
            await this.writeIpConfigs(ipConfigs);
            
            console.log('Cleared all active configs');
            return true;
        } catch (error) {
            console.error('Error clearing active configs:', error);
            throw error;
        }
    }

    async getActiveConfig(type) {
        try {
            if (type === 'serial') {
                const configs = await this.getSerialConfigs();
                return configs.find(c => c.active);
            } else if (type === 'ip') {
                const configs = await this.getIpConfigs();
                return configs.find(c => c.active);
            }
            return null;
        } catch (error) {
            console.error('Error getting active config:', error);
            return null;
        }
    }

    // Debug method - UPDATED for TCP
    async debugCSVFiles() {
        console.log('=== CSV DEBUG INFO (TCP VERSION) ===');
        
        try {
            // Check serial file
            if (await fs.pathExists(this.serialConfigPath)) {
                const serialContent = await fs.readFile(this.serialConfigPath, 'utf8');
                const serialStats = await fs.stat(this.serialConfigPath);
                console.log('Serial CSV Path:', this.serialConfigPath);
                console.log('Serial CSV Size:', serialStats.size);
                console.log('Serial CSV Content:', serialContent);
                console.log('Serial CSV Lines:', serialContent.split('\n').length);
            } else {
                console.log('Serial CSV file does not exist');
            }
            
            // Check IP file
            if (await fs.pathExists(this.ipConfigPath)) {
                const ipContent = await fs.readFile(this.ipConfigPath, 'utf8');
                const ipStats = await fs.stat(this.ipConfigPath);
                console.log('IP CSV Path:', this.ipConfigPath);
                console.log('IP CSV Size:', ipStats.size);
                console.log('IP CSV Content:', ipContent);
                console.log('IP CSV Lines:', ipContent.split('\n').length);
            } else {
                console.log('IP CSV file does not exist');
            }
            
            // Test parsing
            console.log('Testing serial configs parsing...');
            const serialConfigs = await this.getSerialConfigs();
            console.log('Parsed serial configs (TCP):', serialConfigs);
            
            console.log('Testing IP configs parsing...');
            const ipConfigs = await this.getIpConfigs();
            console.log('Parsed IP configs (TCP):', ipConfigs);
            
        } catch (error) {
            console.error('Error in debug:', error);
        }
        
        console.log('=== END CSV DEBUG (TCP VERSION) ===');
    }
}

module.exports = CSVHandler;
