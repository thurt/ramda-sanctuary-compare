
//* Library *///////////////////////////////////////////
//:: a -> a
const trace = (x) => {
  console.log(x)
  return x
}

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
      return E.bimap(leftFn)(rightFn)
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
    },
    join() {
      return newIO(() => {
        return this.runIO().runIO()
      })
    },
    chain(io_returning_fn) {
      return this.map(io_returning_fn).join()
    }
  })

  const constructor = (fn) => {
    if (fn instanceof Function) {
      return newIO(fn)
    } else {
      throw new TypeError(`IO constructor expected instance of Function`)
    }
  }

  constructor.of = (x) => {
    return newIO(() => x)
  }

  constructor.run = (io) => {
    return io.runIO()
  }

  constructor.sequence = (IO_list) => {
    return newIO(() => {
      return IO_list.reduce((accum, io) => {
        return accum.concat(io.runIO())
      }, [])
    })
  }

  return Object.freeze(constructor)
})()


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

//:: String -> IO _
const consoleWarn = (str) => {
  return IO(() => {
    console.warn(str)
    return undefined
  })
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
  return IO(() => {
    N.textContent = str
    return undefined
  })
}

//:: (String, String) -> IO _
const getElementByDataKey_setNodeTextContent = ([key, str]) => {
  return getElementByDataKey(key)
    .chain(E => {
      return E.isLeft
        ? IO(() => E.map(pipe(consoleWarn, IO.run)))
        : IO(() => E.map(pipe(setNodeTextContent(str), IO.run)))
    })
}


//* Domain Compositions *///////////////////////////////

//:: Object -> Promise HTMLDocument
const fetchDOM = pipeP(fetchStr, toHTMLDocument)

//:: Object -> Promise [String]
const get_R_names = pipeP(fetchDOM, scrapeR_names)

//:: Object -> Promise [String]
const get_S_names = pipeP(fetchDOM, scrapeS_names)

//:: Object -> IO _
const DataBind = pipe(toPairs, map(getElementByDataKey_setNodeTextContent), IO.sequence)


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
