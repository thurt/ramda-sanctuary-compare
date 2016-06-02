const { curry, pipe, pipeP, applyFunctions, intersection, difference, flip, last } = require('fp-lib')
const snabbdom = require('snabbdom')
const patch = snabbdom.init([])
const h = require('snabbdom/h')

const createState = ({
  errorMsg,
  ramdaTotal,
  sanctuaryTotal,
  sharedCount,
  sharedFns,
  ramdaOnlyCount,
  ramdaOnlyFns,
  sanctuaryOnlyCount,
  sanctuaryOnlyFns
}) => {
    return h('div', [
    h('h2', 'Compare Results'),
    h('div#error', errorMsg||''),
    h('div', [
      h('div', `Ramda Total: ${ramdaTotal||'?'}`),
      h('div', `Sanctuary Total: ${sanctuaryTotal||'?'}`)
    ]),
    h('div.flex', [
      h('div.col', [
        h('h3', `Shared Functions (${sharedCount||'?'})`),
        h('pre', sharedFns||'')
      ]),
      h('div.col', [
        h('h3', `Ramda Only (${ramdaOnlyCount||'?'})`),
        h('pre', ramdaOnlyFns||'')
      ]),
      h('div.col', [
        h('h3', `Sanctuary Only (${sanctuaryOnlyCount||'?'})`),
        h('pre', sanctuaryOnlyFns||'')
      ]),
    ])
  ])
}


//* Domain Layer *//////////////////////////////////////

//:: String -> Headers { 'Accept': String }
const accept = (mediaTypeStr) => {
  var accept_hdr = new window.Headers()
  accept_hdr.append('Accept', mediaTypeStr)
  return accept_hdr
}

//:: Object -> Promise String
const fetchStr = ({ url, init }) => {
  return window.fetch(url, init).then((res, rej) => {
    if (rej) throw rej // could throw
    return res.text()
  })
}

//:: String -> HTMLDocument
const toHTMLDocument = (str) => {
  var doc = document.implementation.createHTMLDocument()
  doc.documentElement.innerHTML = str
  return doc.documentElement
}

//:: HTMLDocument -> [String]
const scrapeR_names = ($R) => {
  return Array.from($R.querySelectorAll('section.card'))
  .map(card => card.getAttribute('id'))
  .sort()
}

//:: HTMLDocument -> [String]
const scrapeS_names = ($S) => {
  return Array.from($S.querySelectorAll('h4[name]'))
    .map(h4 => last(h4.getAttribute('name').split('-')))
    .sort()
}


//* Domain Compositions *///////////////////////////////

//:: Object -> Promise [String]
const get_R_names = pipeP(fetchStr, toHTMLDocument, scrapeR_names)

//:: Object -> Promise [String]
const get_S_names = pipeP(fetchStr, toHTMLDocument, scrapeS_names)

//:: [[String], [String]] -> IO _
const performComparisonsAndCreateNewState = pipe(
  applyFunctions([intersection, difference, flip(difference)]),
  ([shared, R_only, S_only]) => {
    return createState({
      ramdaTotal: R_only.length + shared.length,
      sanctuaryTotal: S_only.length + shared.length,
      sharedCount: shared.length,
      sharedFns: shared.join('\n'),
      ramdaOnlyCount: R_only.length,
      ramdaOnlyFns: R_only.join('\n'),
      sanctuaryOnlyCount: S_only.length,
      sanctuaryOnlyFns: S_only.join('\n')
    })
  })

//* Input Data */////////////////////////////////////////

const state = createState({})
const r_url = {
  url: 'http://ramdajs.com/0.21.0/docs/'
}
const s_url = {
  url: 'https://api.github.com/repos/sanctuary-js/sanctuary/readme',
  init: { 'headers': accept('application/vnd.github.v3.html') }
}


//* "Fork" */////////////////////////////

// initial rendering with no values
patch(document.getElementById('state'), state)

Promise.all([get_R_names(r_url), get_S_names(s_url)])
  .then(pipe(
    performComparisonsAndCreateNewState,
    curry(patch)(state)))
  .catch(err => {
    patch(state, createState({ errorMsg: String(err.stack) }))
  })
