const {Log, fs, path} = require("chuijs");
const {AppPaths} = require("../settings/paths");
const sqlite3 = require("sqlite3").verbose();


class AvdDB {
    #avd_db = null
    constructor() {
        const filepath = path.join(AppPaths.AVD_DIR, "AvdDB.db");
        if (fs.existsSync(filepath)) {
            this.#avd_db = new sqlite3.Database(filepath);
        } else {
            this.#avd_db = new sqlite3.Database(filepath, (error) => {
                if (error) Log.error(error.message);
            });
        }
    }
    createAvdTable() {
        return new Promise((resolve) => {
            // device, android_ver, image_type, arch, avd_name
            this.#avd_db.exec(`CREATE TABLE IF NOT EXISTS avds (device VARCHAR(50) NOT NULL, android_ver VARCHAR(50) NOT NULL, image_type VARCHAR(50) NOT NULL, arch VARCHAR(50) NOT NULL, avd_name VARCHAR(50) NOT NULL, PRIMARY KEY (avd_name));`);
            resolve("ok")
        })
    }
    addAvdData(device, android_ver, image_type, arch, avd_name) {
        return new Promise((resolve, reject) => {
            this.#avd_db.run(`INSERT INTO avds (device, android_ver, image_type, arch, avd_name) VALUES (?, ?, ?, ?, ?)`,
                [device, android_ver, image_type, arch, avd_name],
                (error) => {
                    if (error) reject(error.message);
                    resolve("ok")
                }
            );
        })
    }
    selectAvdData() {
        return new Promise((resolve, reject) => {
            this.#avd_db.each(`SELECT * FROM avds;`, (error, row) => {
                if (error) reject(error);
                resolve(row)
            });
        })
    }
    async deleteAvdData(avd_name) {
        this.#avd_db.run(`DELETE FROM avds WHERE avd_name = ?`, [avd_name],
            (error) => {
            if (error) Log.error(error.message);
        });
    }
}

exports.AvdDB = AvdDB