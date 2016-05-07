
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

// returns an iterator for an Object. It has this data structure: [key, value]
Object.prototype.entries = function() {
  let keys = Reflect.ownKeys(this)[Symbol.iterator]()
  return {
    [Symbol.iterator]() {
      return this
    },
    next: () => {
       let { done, value: key } = keys.next()
       if (!done) {
         return { value: [key, this[key]] }
       }
       return { done }
    }
  }
}

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
    for (var [k, v] of kv_pairs.entries()) {
      _binder[k] = v
    }
  }
})()

//
var gh_headers = new window.Headers()
gh_headers.append('Accept', 'application/vnd.github.v3.html')
//

Promise.all([
  toHTMLDocument(fetchStr({
    url: 'http://ramdajs.com/0.21.0/docs/'
  })),
  toHTMLDocument(fetchStr({
    url: 'http://api.github.com/repos/sanctuary-js/sanctuary/readme',
    init: { 'headers': gh_headers }
  }))
])
.then(([$ramda, $sanctuary]) => {
  var x_fns = Array.from($ramda.querySelectorAll('section.card'))
    .map(card => card.getAttribute('id'))
    .sort()

  var y_fns = Array.from($sanctuary.querySelectorAll('h4[name]'))
    .map(h4 => h4.getAttribute('name').split('-').reverse()[0])
    .sort()

  var shared_fns = x_fns
    .map(x_fn => [x_fn, y_fns.includes(x_fn)])
    .filter(tuple => tuple[1])
    .map(tuple => tuple[0])

  var x_only_fns = x_fns.filter(x_fn => !shared_fns.includes(x_fn))
  var y_only_fns = y_fns.filter(y_fn => !shared_fns.includes(y_fn))

  DataBind({
    "ramda-total": x_fns.length,
    "sanctuary-total": y_fns.length,
    "shared-count": shared_fns.length,
    "shared-fns": shared_fns.join('\n'),
    "ramda-only-count": x_fns.length - shared_fns.length,
    "ramda-only-fns": x_only_fns.join('\n'),
    "sanctuary-only-count": y_fns.length - shared_fns.length,
    "sanctuary-only-fns": y_only_fns.join('\n')
  })
}, err => {
  console.error(err)
})
