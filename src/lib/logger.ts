import {format} from 'util'
import {EventEmitter} from 'events'
import * as assert from 'assert'

export type LevelType = 1 | 2 | 3 | 4 | 5 | 6

export default class Logger {
    public static readonly FATAL = 1
    public static readonly ERROR = 2
    public static readonly WARN = 3
    public static readonly INFO = 4
    public static readonly DEBUG = 5
    public static readonly TRACE = 6

    constructor(private level: LevelType = 4, private stream = process.stdout) {
        assert.ok(typeof level === 'number', "level")
        assert.ok(level >= 1 && level <= 6, "level")
    }
    public fatal(...args: any[]) {
        return this.log("FATAL", args)
    }
    public error(...args: any[]) {
        return this.log("FATAL", args)
    }
    public warn(...args: any[]) {
        return this.log("WARN", args)
    }
    public info(...args: any[]) {
        return this.log("INFO", args)
    }
    public debug(...args: any[]) {
        return this.log("DEBUG", args)
    }
    public trace(...args: any[]) {
        return this.log("TRACE", args)
    }
    private log(levelStr, args) {
        if (Logger[levelStr] > this.level) {
            return
        }

        this.stream.write(
            '[' + new Date() + ']'
            + ' ' + levelStr
            + ' ' + format.apply(null, args)
            + '\n'
        )
    }
}