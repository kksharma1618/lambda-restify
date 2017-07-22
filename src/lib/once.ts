export default function once (fn) {
  let f: any = function () {
    if (f.called) {
        return f.value
    } 
    f.called = true
    return f.value = fn.apply(null, arguments)
  }
  f.called = false
  return f
}