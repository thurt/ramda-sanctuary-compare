const { pipe, pipeP, applyFunctions, intersection, difference, flip, last } = require('fp-lib')
const snabbdom = require('snabbdom')

//* Domain Layer *//////////////////////////////////////

//:: ((HTMLElement || VNode), VNode) -> _
const patch = snabbdom.init([])

//:: __polymorphic__ -> VNode
const v = require('snabbdom/h')

//:: Object -> VNode
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
    return v('div', [
    v('h2', 'Compare Results'),
    v('div#error', errorMsg||''),
    v('div', [
      v('div', `Ramda Total: ${ramdaTotal||'?'}`),
      v('div', `Sanctuary Total: ${sanctuaryTotal||'?'}`)
    ]),
    v('div.flex', [
      v('div.col', [
        v('h3', `Shared Functions (${sharedCount||'?'})`),
        v('pre', sharedFns||'')
      ]),
      v('div.col', [
        v('h3', `Ramda Only (${ramdaOnlyCount||'?'})`),
        v('pre', ramdaOnlyFns||'')
      ]),
      v('div.col', [
        v('h3', `Sanctuary Only (${sanctuaryOnlyCount||'?'})`),
        v('pre', sanctuaryOnlyFns||'')
      ]),
    ])
  ])
}

//:: String -> Headers { 'Accept': String }
const accept = (mediaTypeStr) => {
  var accept_hdr = new window.Headers()
  accept_hdr.append('Accept', mediaTypeStr)
  return accept_hdr
}

//:: Object -> Promise Error || Promise String
const fetchStr = ({ url, init }) => {
  return window.fetch(url, init).then((result, reject) => {
    if (reject) throw reject // could throw
    return result.text()
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
const fetch_R_names = pipeP(fetchStr, pipe(toHTMLDocument, scrapeR_names))

//:: Object -> Promise [String]
const fetch_S_names = pipeP(fetchStr, pipe(toHTMLDocument, scrapeS_names))

//:: [[String], [String]] -> Object
const doComparisonsAndCreateResultObject = pipe(
  applyFunctions([intersection, difference, flip(difference)]),
  ([shared, R_only, S_only]) => {
    return {
      ramdaTotal: R_only.length + shared.length,
      sanctuaryTotal: S_only.length + shared.length,
      sharedCount: shared.length,
      sharedFns: shared.join('\n'),
      ramdaOnlyCount: R_only.length,
      ramdaOnlyFns: R_only.join('\n'),
      sanctuaryOnlyCount: S_only.length,
      sanctuaryOnlyFns: S_only.join('\n')
    }
  })

//* Input Data */////////////////////////////////////////

const r_url = {
  url: 'http://ramdajs.com/0.21.0/docs/'
}
const s_url = {
  url: 'https://api.github.com/repos/sanctuary-js/sanctuary/readme',
  init: { 'headers': accept('application/vnd.github.v3.html') }
}
const page_state = createState({})

//* "Fork" */////////////////////////////

// initiate parallel fetches
Promise.all([fetch_R_names(r_url), fetch_S_names(s_url)])
  .then(doComparisonsAndCreateResultObject)
  .then(resultObj => patch(page_state, createState(resultObj)))
  .catch(error => patch(page_state, createState({ errorMsg: String(error) })))

// initial rendering with no values
patch(document.getElementById('state'), page_state)