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

// pipe :: ((a, b, ... -> e), (e -> f), ..., (y -> z)) -> (a, b, ...) -> z
function pipe(...fns) {
  return (...x) =>
    fns.slice(1).reduce((x, fn) => fn(x), fns[0](...x))
}

// fetchDOM :: Object -> Promise HTMLDocument
var fetchDOM = pipe(fetchStr, toHTMLDocument)

// gets all html elements with data-key attribute and stores them in a dictonary.
// later, using DataBind function triggers a setter function for that key
// which applies the assigned value to the associated node.textContent
var DataBind = (() => {
  // private member
  var _binder = Array.from(document.querySelectorAll('[data-key]'))
    .reduce((dict, node) => {
      Object.defineProperty(dict, node.dataset.key, {
        set(new_value) {
          // node is in the closure
          node.textContent = new_value
        }
      })
      return dict
    }, {})

  // DataBind function
  return (kv_pairs) => {
    for (var [k, v] of entries(kv_pairs)) {
      _binder[k] = v
    }
  }
})()

// entries :: Object -> Array
function entries(obj) {
  return Reflect.ownKeys(obj).map(key => [key, obj[key]])
}

// accept :: String -> Headers { 'Accept': String }
function accept(mediaTypeStr) {
  var accept_hdr = new window.Headers()
  accept_hdr.append('Accept', mediaTypeStr)
  return accept_hdr
}

///////////////////////////////////////////////////

// input data
var ramda = {
  url: 'http://ramdajs.com/0.21.0/docs/'
}
var sanctuary = {
  url: 'http://api.github.com/repos/sanctuary-js/sanctuary/readme',
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
