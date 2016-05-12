
//* Library *///////////////////////////////////////////

// pipeP :: ((a, b, ... -> e), (e -> f), ..., (y -> z)) -> (a, b, ...) -> z
function pipeP(...fns) {
  return (...xs) =>
    fns.slice(1).reduce((xP, fn) => xP.then(fn), Promise.resolve(fns[0](...xs)))
}

// map :: (a -> b) -> [a] -> [b]
function map(fn) {
  return (f) => f.map(fn)
}

// last :: [a] -> a
function last(xs) {
  return xs[xs.length - 1]
}

// adjust :: (a -> a) -> Number -> [a] -> [a]
function adjust(fn) {
  return (i) => (list) => {
    var copy = list.slice()
    copy.splice(i, 1, fn(list[i]))
    return copy
  }
}

// toPairs :: Object -> Array
function toPairs(obj) {
  return Reflect.ownKeys(obj).map(key => [key, obj[key]])
}


//* Domain Layer *//////////////////////////////////////

// fetchStr :: Object -> Promise String
function fetchStr({ url, init }) {
  return window.fetch(url, init).then((res, rej) => {
    if (rej) throw new Error(rej) // could throw
    return res.text()
  })
}

// toHTMLDocument :: String -> HTMLDocument
function toHTMLDocument(str) {
  var doc = document.implementation.createHTMLDocument()
  doc.documentElement.innerHTML = str
  return doc.documentElement
}

// getElementByDataKey :: String -> HTMLElement
function getElementByDataKey(key) {
  return document.querySelector(`[data-key=${key}]`)
}

// setTextContent :: Array -> _
function setTextContent([node, value]) {
  node.textContent = value
}

// accept :: String -> Headers { 'Accept': String }
function accept(mediaTypeStr) {
  var accept_hdr = new window.Headers()
  accept_hdr.append('Accept', mediaTypeStr)
  return accept_hdr
}


//* Domain Compositions *///////////////////////////////

// fetchDOM :: Object -> Promise HTMLDocument
var fetchDOM = pipeP(fetchStr, toHTMLDocument)

// get_R_names :: Object -> Promise [String]
var get_R_names = pipeP(
  fetchDOM,
  ($R) => Array.from($R.querySelectorAll('section.card'))
    .map(card => card.getAttribute('id'))
    .sort())

// get_S_names :: Object -> Promise [String]
var get_S_names = pipeP(
  fetchDOM,
  ($S) => Array.from($S.querySelectorAll('h4[name]'))
      .map(h4 => last(h4.getAttribute('name').split('-')))
      .sort())

// DataBind :: Object -> _
var DataBind = pipeP(
  toPairs,
  map(adjust(getElementByDataKey)(0)), // adjust is mutating tuple type here
  map(setTextContent))


//* Input Data */////////////////////////////////////////

var r_url = {
  url: 'http://ramdajs.com/0.21.0/docs/'
}
var s_url = {
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