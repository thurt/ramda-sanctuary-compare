
//* Library *///////////////////////////////////////////

//:: ((a, b, ... -> e), (e -> f), ..., (y -> z)) -> (a, b, ...) -> z
const pipe = (...fns) => (...xs) => {
  return fns
    .slice(1)
    .reduce((x, fn) => fn(x), fns[0](...xs))
}
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
/*
//:: Int -> [a] -> a
const nth = (n) => (xs) => {
  return xs[n]
}

//:: (a -> b -> c) -> b -> a -> c
const flip = (fn) => (b) => (a) => {
  return fn(a)(b)
}

//:: (a -> a) -> Number -> [a] -> [a]
const adjust = (fn) => (i) => (list) => {
  var copy = list.slice()
  copy.splice(i, 1, fn(list[i]))
  return copy
}
*/
//:: Object -> Array
const toPairs = (obj) => {
  return Reflect.ownKeys(obj).map(key => [key, obj[key]])
}

// Maybe type
const Maybe = (() => {
  const newM = (type) => (value) => {
    return Object.freeze(Object.create(type, { __value: { value: value }}))
  }

  const Nothing = Object.freeze({
    map(_) {
      return newM(Nothing)(null)
    },
    isNothing: true,
    isJust: false
  })

  const Just = Object.freeze({
    map(fn) {
      return newM(Just)(fn(this.__value))
    },
    isNothing: false,
    isJust: true
  })

  const Maybe = (x) => {
    return (x == null)
      ? newM(Nothing)(null)
      : newM(Just)(x)
  }

  Maybe.isNothing = (M) => {
    return Nothing.isPrototypeOf(M)
  }

  Maybe.isJust = (M) => {
    return Just.isPrototypeOf(M)
  }

  return Object.freeze(Maybe)
})()

// Either type
const Either = (() => {
  const newE = (type) => (value) => {
    return Object.freeze(Object.create(type, { __value: { value: value } }))
  }

  const Left = Object.freeze({
    map(_) {
      return this
    },
    bimap(fn) {
      const me = this
      return (_) => {
        return newE(Left)(fn(me.__value))
      }
    },
    isLeft: true,
    isRight: false
  })

  const Right = Object.freeze({
    map(fn) {
      return newE(Right)(fn(this.__value))
    },
    bimap(_) {
      const me = this
      return (fn) => {
        return me.map(fn)
      }
    },
    isLeft: false,
    isRight: true
  })

  const Either = Object.freeze({
    Left(x) {
      return newE(Left)(x)
    },
    Right(x) {
      return newE(Right)(x)
    },
    isRight(E) {
      return Right.isPrototypeOf(E)
    },
    isLeft(E) {
      return Left.isPrototypeOf(E)
    },
    bimap: (leftFn) => (rightFn) => (E) => {
      E.bimap(leftFn)(rightFn)
    }
  })

  return Either
})()

// IO type
const IO = (() => {
  const newIO = (fn) => {
    return Object.freeze(Object.create(IO, { __value: { value: fn }}))
  }

  const IO = Object.freeze({
    runIO(...args) {
      return this.__value(...args)
    },
    map(fn) {
      return newIO(() => fn(this.__value()))
    }
  })

  const constructor = (fn) => {
    if (Function.prototype.isPrototypeOf(fn)) {
      return newIO(fn)
    } else {
      throw new TypeError(`IO constructor expected type Function`)
    }
  }

  constructor.of = (x) => {
    return newIO(() => x)
  }

  constructor.sequence = (IO_list) => {
    return IO(() => {
      return IO_list.reduce(io => io.runIO(), [])
    })
  }

  return Object.freeze(constructor)
})()


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

//:: String -> IO (Either String HTMLElement)
const getElementByDataKey = (key) => {
  return IO(() => {
    const el = document.querySelector(`[data-key=${key}]`)

    return (Maybe(el).isNothing)
      ? Either.Left(`get element by data-key "${key}" is not found`)
      : Either.Right(el)
  })
}

//:: String -> Node -> IO _
const setNodeTextContent = (str) => (N) => {
  //return IO(() => {
    N.textContent = str
    return undefined
  //})
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
  ($R) => {
    return Array.from($R.querySelectorAll('section.card'))
    .map(card => card.getAttribute('id'))
    .sort()
  })

//:: Object -> Promise [String]
const get_S_names = pipeP(
  fetchDOM,
  ($S) => {
    return Array.from($S.querySelectorAll('h4[name]'))
      .map(h4 => last(h4.getAttribute('name').split('-')))
      .sort()
  })

//:: Object -> IO _
const DataBind = pipe(
  toPairs,
  map(([key, str]) => {
    return getElementByDataKey(key).map
      (Either.bimap (console.warn) (setNodeTextContent(str)))
  }),
  IO.sequence)


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
    R_names.filter(n => S_names.includes(n)),
    R_names.filter(n => !S_names.includes(n)),
    S_names.filter(n => !R_names.includes(n))
  ])

  // Side-Effect: Bind data values to the page
  .then(([shared, R_only, S_only]) => {
    DataBind({
      'ramda-total': R_only.length + shared.length,
      'sanctuary-total': S_only.length + shared.length,
      'shared-count': shared.length,
      'shared-fns': shared.join('\n'),
      'ramda-only-count': R_only.length,
      'ramda-only-fns': R_only.join('\n'),
      'sanctuary-only-count': S_only.length,
      'sanctuary-only-fns': S_only.join('\n')
    }).runIO()
  })

.catch(err => {
  console.error(err)
})