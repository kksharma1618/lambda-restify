export default function once(fn) {
  const f: any = () => {
    if (f.called) {
        return f.value
    }
    f.called = true
    return f.value = fn.apply(null, arguments)
  }
  f.called = false
  return f
}