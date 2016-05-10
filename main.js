// pipe :: ((a, b, ... -> e), (e -> f), ..., (y -> z)) -> (a, b, ...) -> z
function pipe(...fns) {
  return (...x) =>
    fns.slice(1).reduce((x, fn) => fn(x), fns[0](...x))
}

// map :: (a -> b) -> [a] -> [b]
function map(fn) {
  return (f) => f.map(fn)
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

/////////////////////////////////////////////////////

// fetchStr :: Object -> Promise String
function fetchStr({ url, init }) {
  return window.fetch(url, init).then((res, rej) => {
    if (rej) throw new Error(rej) // could throw
    return res.text()
  })
}

// toHTMLDocument :: Promise String -> Promise HTMLDocument
function toHTMLDocument(pstr) {
  return pstr.then(htmlStr => {
    var doc = document.implementation.createHTMLDocument()
    doc.documentElement.innerHTML = htmlStr
    return doc.documentElement
  })
}

// accept :: String -> Headers { 'Accept': String }
function accept(mediaTypeStr) {
  var accept_hdr = new window.Headers()
  accept_hdr.append('Accept', mediaTypeStr)
  return accept_hdr
}

// getElementByDataKey :: String -> HTMLElement
function getElementByDataKey(key) {
  return document.querySelector(`[data-key=${key}]`)
}

// setTextContent :: Array -> _
function setTextContent([node, value]) {
  node.textContent = value
}

// fetchDOM :: Object -> Promise HTMLDocument
var fetchDOM = pipe(fetchStr, toHTMLDocument)

// DataBind :: Object -> _
var DataBind = pipe(
  toPairs,
  map(
    pipe(
      adjust(getElementByDataKey)(0), // adjust is mutating type here
      setTextContent
    )
  )
)
//////////////////////////////////////////////////////

// input data
var ramda = {
  url: 'http://ramdajs.com/0.21.0/docs/'
}
var sanctuary = {
  url: 'https://api.github.com/repos/sanctuary-js/sanctuary/readme',
  init: { 'headers': accept('application/vnd.github.v3.html') }
}

Promise.all([ramda, sanctuary].map(fetchDOM))
  // Perform DOM scraping to get function names
  .then(([$R, $S]) => [
    Array.from($R.querySelectorAll('section.card'))
      .map(card => card.getAttribute('id'))
      .sort()
    ,
    Array.from($S.querySelectorAll('h4[name]'))
      .map(h4 => h4.getAttribute('name').split('-').reverse()[0])
      .sort()
  ])

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