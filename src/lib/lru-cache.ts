export default class LruCache {
    private items: Map<string, any>
    private itemKeys: string[]
    private max: number

    constructor(opts) {
        this.max = opts.max || 100
        this.items = new Map()
        this.itemKeys = []
    }
    public has(key: string) {
        return this.items.has(key)
    }
    public get(key: string, defaultValue?) {
        if(!this.has(key)) {
            return defaultValue
        }
        this.makeKeyRecent(key)
        return this.items.get(key)
    }
    public set(key: string, value: any) {
        this.makeKeyRecent(key)
        this.items.set(key, value)
        return this
    }
    public del(key: string) {
        const ik = this.itemKeys.indexOf(key)
        if(ik >= 0) {
            this.itemKeys.splice(ik, 1)
        }
        this.items.delete(key)
        return this
    }
    private makeKeyRecent(key: string) {

        const index = this.itemKeys.indexOf(key)
        if(index === 0) {
            // already most recent
            return
        }
        if(index > 0) {
            // has, but not first
            this.itemKeys.splice(index, 1)
            this.itemKeys.unshift(key)
        }
        else {
            // doesnt have
            this.itemKeys.unshift(key)
            if(this.itemKeys.length > this.max) {
                this.del(this.itemKeys.pop() as string)
            }
        }
    }
}