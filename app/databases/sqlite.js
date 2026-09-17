const {Log, fs, path} = require("chuijs");
const {AppPaths} = require("../settings/paths");
const sqlite3 = require("sqlite3").verbose();


class AvdDB {
    #avd_db = null
    constructor() {
        const filepath = path.join(AppPaths.AVD_DIR, "AvdDB.db");
        this.#avd_db = new sqlite3.Database(filepath, (error) => {
            if (error) Log.error(error.message);
        });
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
            this.#avd_db.run(`INSERT OR REPLACE INTO avds (device, android_ver, image_type, arch, avd_name) VALUES (?, ?, ?, ?, ?)`,
                [device, android_ver, image_type, arch, avd_name],
                (error) => {
                    if (error) return reject(error.message);
                    resolve("ok")
                }
            );
        })
    }
    selectAvdData() {
        return new Promise((resolve, reject) => {
            this.#avd_db.all(`SELECT * FROM avds;`, (error, rows) => {
                if (error) return reject(error);
                resolve(rows)
            });
        })
    }
    deleteAvdData(avd_name) {
        return new Promise((resolve, reject) => {
            this.#avd_db.run(`DELETE FROM avds WHERE avd_name = ?`, [avd_name], (error) => {
                if (error) return reject(error.message);
                resolve()
            });
        })
    }
}

exports.AvdDB = AvdDB