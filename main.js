
//* Library *///////////////////////////////////////////

//:: ((a, b, ... -> e), (e -> f), ..., (y -> z)) -> (a, b, ...) -> z
const pipeP = (...fns) => (...xs) => {
  return fns
    .slice(1)
    .reduce((xP, fn) => xP.then(fn), Promise.resolve(fns[0](...xs)))
}

//:: (a -> b) -> [a] -> [b]
const map = (fn) => (f) => {
  return f.map(fn)
}

//:: [a] -> a
const last = (xs) => {
  return xs[xs.length - 1]
}

//:: (a -> a) -> Number -> [a] -> [a]
const adjust = (fn) => (i) => (list) => {
  var copy = list.slice()
  copy.splice(i, 1, fn(list[i]))
  return copy
}

//:: Object -> Array
const toPairs = (obj) => {
  return Reflect.ownKeys(obj).map(key => [key, obj[key]])
}

const Maybe = (x) => {
  return (x === null) ? Nothing() : Just(x)
}
const Just = (x) => {
  return {
    map(fn) { return Maybe(fn(x)) }
  }
}
const Nothing = () => {
  return {
    map(fn) { return Maybe(null) }
  }
}
//* Domain Layer *//////////////////////////////////////

//:: Object -> Promise String
const fetchStr = ({ url, init }) => {
  return window.fetch(url, init).then((res, rej) => {
    if (rej) throw new Error(rej) // could throw
    return res.text()
  })
}

//:: String -> HTMLDocument
const toHTMLDocument = (str) => {
  var doc = document.implementation.createHTMLDocument()
  doc.documentElement.innerHTML = str
  return doc.documentElement
}

//:: String -> Maybe HTMLElement
const getElementByDataKey = (key) => {
  return Maybe(document.querySelector(`[data-key=${key}]`))
}

//:: [Maybe Node, String] -> _
const setNodeTextContent = ([nodeM, text]) => {
  nodeM.map(node => node.textContent = text)
}

//:: String -> Headers { 'Accept': String }
const accept = (mediaTypeStr) => {
  var accept_hdr = new window.Headers()
  accept_hdr.append('Accept', mediaTypeStr)
  return accept_hdr
}


//* Domain Compositions *///////////////////////////////

//:: Object -> Promise HTMLDocument
const fetchDOM = pipeP(fetchStr, toHTMLDocument)

//:: Object -> Promise [String]
const get_R_names = pipeP(
  fetchDOM,
  ($R) => Array.from($R.querySelectorAll('section.card'))
    .map(card => card.getAttribute('id'))
    .sort())

//:: Object -> Promise [String]
const get_S_names = pipeP(
  fetchDOM,
  ($S) => Array.from($S.querySelectorAll('h4[name]'))
      .map(h4 => last(h4.getAttribute('name').split('-')))
      .sort())

//:: Object -> _
const DataBind = pipeP(
  toPairs,
  map(adjust(getElementByDataKey)(0)), // adjust is mutating tuple type here
  map(setNodeTextContent))


//* Input Data */////////////////////////////////////////

const r_url = {
  url: 'http://ramdajs.com/0.21.0/docs/'
}
const s_url = {
  url: 'https://api.github.com/repos/sanctuary-js/sanctuary/readme',
  init: { 'headers': accept('application/vnd.github.v3.html') }
}


//* "Fork" & Merge operations */////////////////////////////

Promise.all([get_R_names(r_url), get_S_names(s_url)])
  // Determine shared function names, R-only names, and S-only names
  .then(([R_names, S_names]) => [
    R_names
      .filter(n => S_names.includes(n))
    ,
    R_names
      .filter(n => !S_names.includes(n))
    ,
    S_names
      .filter(n => !R_names.includes(n))
  ])

  // Side-Effect: Bind data values to the page
  .then(([shared, R_only, S_only]) => {
    DataBind({
      "ramda-total": R_only.length + shared.length,
      "sanctuary-total": S_only.length + shared.length,
      "shared-count": shared.length,
      "shared-fns": shared.join('\n'),
      "ramda-only-count": R_only.length,
      "ramda-only-fns": R_only.join('\n'),
      "sanctuary-only-count": S_only.length,
      "sanctuary-only-fns": S_only.join('\n')
    })
  })

.catch(err => {
  console.error(err)
})