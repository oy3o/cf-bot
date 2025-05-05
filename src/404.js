const html_404 =  `<!DOCTYPE html>
<html lang='auto'>

<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <meta http-equiv='Content-Security-Policy' content="object-src 'none'; base-uri 'self';">
    <title>404 | PAGE NOT FOUND</title>
    <style>
        :root {
            color: #ddd;
            background-color: black;
            font-family: Consolas, Menlo, Monaco, Courier, monospace;
            font-size: 10vmin;
            cursor: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' fill='rgb(245 245 245)' viewBox='0 -960 960 960'><path d='M480.28-96Q401-96 331-126t-122.5-82.5Q156-261 126-330.96t-30-149.5Q96-560 126-629.5q30-69.5 82.5-122T330.96-834q69.96-30 149.5-30t149.04 30q69.5 30 122 82.5T834-629.28q30 69.73 30 149Q864-401 834-331t-82.5 122.5Q699-156 629.28-126q-69.73 30-149 30Zm-.28-72q130 0 221-91t91-221q0-130-91-221t-221-91q-130 0-221 91t-91 221q0 130 91 221t221 91Zm0-312Z'/></svg>") 16 16, auto !important;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            overflow: hidden;
        }

        main {
            display: flex;
            width: 100%;
            height: 100vh;

            align-items: center;
            flex-direction: column;
            justify-content: center;
            transform: translate3d(0, 0, 0);
            z-index: 1;
            text-align: center;
        }

        body>main {
            filter: url('#noise') url('#light');
        }

        h1 {
            margin: 0;
        }

        svg {
            position: absolute;
        }
    </style>
</head>

<body>
    <main>
        <h1>404</h1>
        <span>PAGE NOT FOUND</span>
    </main>
    <svg>
        <filter id='noise'>
            <feTurbulence type='fractalNoise' baseFrequency='0.999 0.999' seed='0.8932661012652932' numOctaves='10'>
            </feTurbulence>
            <feBlend in='noise-alpha' in2='SourceGraphic' mode='multiply'></feBlend>
        </filter>
    </svg>
    <script>
        class Timer {
            constructor(once, interval, func, ...args) {
                this.once = once
                this.interval = interval
                this.func = func
                this.args = args
                this.run_time = Date.now() + interval
                this.id = null
                this.task = () => {
                    let wait_time = this.run_time - Date.now()
                    if (wait_time <= 0) {
                        this.func(...this.args)
                        this.run_time = Date.now() + this.interval
                        this.id = once ? null : setTimeout(this.task, this.interval)
                    } else this.id = setTimeout(this.task, wait_time)
                }
            }
            update(...args) {
                this.args = args
                this.run_time = Date.now() + this.interval
                return this
            }
            start() { this.id ||= setTimeout(this.task, this.interval) }
            stop() {
                clearTimeout(this.id)
                this.id = null
            }
        }

        function throttle(func, interval = 16, trailing = true) {
            let timer = null
            let last_time = 0
            let now = 0
            function wrapper(...args) {
                now = Date.now()
                if (trailing) {
                    if (timer) timer.update(args)
                    else {
                        timer = new Timer(true, interval, args => {
                            timer = null
                            last_time = now
                            func(...args)
                        }, args)
                        timer.start()
                    }
                }
                if (now - last_time > interval) {
                    last_time = now
                    return func(...args)
                }
            }
            wrapper.immediate = (...args) => {
                last_time = now
                return func(...args)
            }
            return wrapper
        }

        const attrs = (element, attrs = {}, ...children) => {
            if (attrs) for (const key in attrs) {
                if (attrs[key] == null) continue

                if (typeof attrs[key] === 'boolean')
                    attrs[key] && element.setAttribute(key, '')
                else if (key === 'style' && typeof attrs[key] === 'object')
                    Object.assign(element.style, attrs[key])
                else if (key === 'class')
                    element.className = attrs[key]
                else if (key.startsWith('on') && typeof attrs[key] === 'function')
                    element.addEventListener(key.substring(2).toLowerCase(), attrs[key])
                else
                    element.setAttribute(key, attrs[key])
            }

            for (let child of children.flat())
                child instanceof Node ?
                    element.appendChild(child) :
                    child && element.appendChild(document.createTextNode(child))

            return element
        }

        const SVG_NS = 'http://www.w3.org/2000/svg'
        const h = (tag, ...args) => attrs(document.createElement(tag), ...args)
        const hSVG = (tag, ...args) => attrs(document.createElementNS(SVG_NS, tag), ...args)

        class PointLight {
            static counter = 0

            #element = null
            #id = null
            #props = null
            #specularLighting = null
            #pointLight = null

            constructor({
                id = 'pointlight-auto-' + PointLight.counter++,
                deep = 4,
                intensity = 1.5,
                convergence = 10,
                color = '#999',
                x = 0,
                y = 0,
                z = 100,
            } = {}) {
                this.#id = id
                this.#props = new Map([
                    ['deep', deep],
                    ['intensity', intensity],
                    ['convergence', convergence],
                    ['color', color],
                    ['x', x],
                    ['y', y],
                    ['z', z],
                ])

                const getSpecularAttrs = () => ({
                    in: 'blurAlpha',
                    result: 'specOut',
                    surfaceScale: this.#props.get('deep'),
                    specularConstant: this.#props.get('intensity'),
                    specularExponent: this.#props.get('convergence'),
                    'lighting-color': this.#props.get('color'),
                })

                const getPointLightAttrs = () => ({
                    x: this.#props.get('x'),
                    y: this.#props.get('y'),
                    z: this.#props.get('z'),
                })

                this.#pointLight = hSVG('fePointLight', getPointLightAttrs())
                this.#specularLighting = hSVG('feSpecularLighting', getSpecularAttrs(), this.#pointLight)

                this.#element = hSVG('svg', null,
                    hSVG('filter', { id },
                        hSVG('feGaussianBlur', {
                            in: 'SourceAlpha',
                            stdDeviation: '0.5',
                            result: 'blurAlpha',
                        }),
                        this.#specularLighting
                    )
                )

                return new Proxy(this, {
                    get: (target, prop, receiver) => {
                        if (prop === 'id') return target.#id
                        if (prop === 'element') return target.#element
                        return target.#props.get(prop) ?? Reflect.get(target, prop, receiver)
                    },
                    set: (target, prop, value, receiver) => {
                        switch (prop) {
                            case 'deep':
                            case 'intensity':
                            case 'convergence':
                            case 'color':
                                attrs(target.#specularLighting, getSpecularAttrs())
                                break
                            case 'x':
                            case 'y':
                            case 'z':
                                attrs(target.#pointLight, getPointLightAttrs())
                                break
                            default:
                                return Reflect.set(target, prop, value, receiver)
                        }
                        target.#props.set(prop, value)
                        return true
                    }
                })
            }
        }

        const light = new PointLight({ id: 'light' })
        document.body.append(light.element)
        if (window.visualViewport.width > 1200) {
            document.addEventListener('pointermove', throttle(e => {
                requestAnimationFrame(() => {
                    light.x = e.pageX
                    light.y = e.pageY
                })
            }))
        } else {
            let animationFrameId = null
            let lastTimestamp = 0

            const width = window.innerWidth
            const height = window.innerHeight
            const max = Math.min(width, height) / 2 * 0.8
            const animationSpeed = max / 2000 * 1

            const startX = width / 2
            const startY = height / 2
            light.x = startX
            light.y = startY

            let percentX = 1
            let percentY = 1

            let stateX = true
            let stateY = false

            function animateLight(timestamp) {
                if (!lastTimestamp) {
                    lastTimestamp = timestamp
                }
                const deltaTime = timestamp - lastTimestamp
                lastTimestamp = timestamp

                let distanceToMoveX = animationSpeed * deltaTime * percentX
                let distanceToMoveY = animationSpeed * deltaTime * percentY

                let change = false
                if (stateX) {
                    light.x += distanceToMoveX
                    if (light.x >= startX + max) {
                        change = true
                        stateX = false
                        percentX = 0.5 + 0.5 * Math.random()
                    }
                } else {
                    light.x -= distanceToMoveX
                    if (light.x <= startX - max) {
                        change = true
                        stateX = true
                        percentX = 0.5 + 0.5 * Math.random()
                    }
                }

                if (stateY) {
                    light.y += distanceToMoveY
                    if (light.y >= startY + max) {
                        change = true
                        stateY = false
                        percentX = 0.4 + 0.6 * Math.random()
                    }
                } else {
                    light.y -= distanceToMoveY
                    if (light.y <= startY - max) {
                        change = true
                        stateY = true
                        percentX = 0.4 + 0.6 * Math.random()
                    }
                }

                if (change) setTimeout(() => {
                    lastTimestamp = null
                    animationFrameId = requestAnimationFrame(animateLight)
                }, 200 + 200 * Math.random())
                else animationFrameId = requestAnimationFrame(animateLight)
            }
            animationFrameId = requestAnimationFrame(animateLight)
        }
    </script>
</body>

</html>`

export default html_404