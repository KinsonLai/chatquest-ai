import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export class Store {
  constructor(filename) {
    if (filename !== ":memory:")
      mkdirSync(dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db
      .exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS campaigns(id TEXT PRIMARY KEY,name TEXT NOT NULL,world TEXT NOT NULL,seed TEXT NOT NULL,created TEXT NOT NULL,request_key TEXT UNIQUE NOT NULL,request_hash TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS branches(campaign TEXT NOT NULL,id TEXT NOT NULL,name TEXT NOT NULL,premise TEXT NOT NULL,parent TEXT,parent_revision INTEGER,revision INTEGER NOT NULL,state TEXT NOT NULL,initial TEXT NOT NULL,request_key TEXT NOT NULL,request_hash TEXT NOT NULL,PRIMARY KEY(campaign,id),UNIQUE(campaign,request_key),FOREIGN KEY(campaign) REFERENCES campaigns(id));
 CREATE TABLE IF NOT EXISTS events(campaign TEXT NOT NULL,branch TEXT NOT NULL,revision INTEGER NOT NULL,id TEXT UNIQUE NOT NULL,request_key TEXT NOT NULL,request_hash TEXT NOT NULL,state TEXT NOT NULL,receipt TEXT NOT NULL,request_json TEXT NOT NULL,created TEXT NOT NULL,PRIMARY KEY(campaign,branch,revision),UNIQUE(campaign,branch,request_key),FOREIGN KEY(campaign,branch) REFERENCES branches(campaign,id));
 CREATE TABLE IF NOT EXISTS preparations(id TEXT PRIMARY KEY,campaign TEXT NOT NULL,branch TEXT NOT NULL,revision INTEGER NOT NULL,action TEXT NOT NULL,state_hash TEXT NOT NULL,policy TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS checks(campaign TEXT NOT NULL,branch TEXT NOT NULL,revision INTEGER NOT NULL,purpose TEXT NOT NULL,check_id TEXT NOT NULL,signature TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(campaign,branch,revision,purpose),UNIQUE(campaign,branch,revision,check_id));
 CREATE TABLE IF NOT EXISTS sources(campaign TEXT NOT NULL,id TEXT NOT NULL,title TEXT NOT NULL,hash TEXT NOT NULL,PRIMARY KEY(campaign,id));
 CREATE TABLE IF NOT EXISTS chunks(id TEXT PRIMARY KEY,campaign TEXT NOT NULL,source TEXT NOT NULL,title TEXT NOT NULL,text TEXT NOT NULL,citation TEXT NOT NULL);
 CREATE VIRTUAL TABLE IF NOT EXISTS canon_fts USING fts5(chunk_id UNINDEXED,campaign UNINDEXED,body,tokenize='unicode61');`);
  }
  get(sql, ...args) {
    return this.db.prepare(sql).get(...args);
  }
  all(sql, ...args) {
    return this.db.prepare(sql).all(...args);
  }
  run(sql, ...args) {
    return this.db.prepare(sql).run(...args);
  }
  transaction(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const value = fn();
      this.db.exec("COMMIT");
      return value;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  close() {
    this.db.close();
  }
}
