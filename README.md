*This is __Part 1__ of the series* "Modular Isomorphic React JS applications".
*See [Part 2](https://github.com/jesstelford/react-testing-mocha-jsdom) and
[Part 3](https://github.com/jesstelford/react-testing-isomorphic) for more.*

# Isomorphic Server & Browser Side Rendering with React >= 0.12

**tl;dr**: Using React + Handlebars + Browserify to render your DOM server
side while keeping React's awesomeness browser side too.

## Introduction

**tl;dr**: React's virtual DOM is smart and powerful.

[React](https://facebook.github.io/react/) is now famous for utilizing a
virtual DOM to implement exceptionally quick and efficient re-renders in the
browser.

Thanks to the virtual DOM, we don't actually need a browser or DOM implementation
to begin rendering. In fact, React gives us enough to render a DOM tree to raw
HTML anywhere we can run Javascript. And that includes node/io.js on the server!

One of React's real strengths is the ability to seamlessly understand
React-rendered HTML in both the sever and the browser. For example; render a DOM
tree once on the server, then call `.render()` again on the browser without any
state change, and React is smart enough not to re-render the unchanged DOM. This
means we can render critical-path HTML server side with no flash of reloaded JS
on the browser!

## Let's do it

**tl;dr** [Get the completed
example](https://github.com/jesstelford/react-isomorphic-boilerplate)

We'll be using these libraries:

 * [Node.js](http://nodejs.org)
 * [npm](https://www.npmjs.org)
 * [React](https://www.npmjs.com/package/react) ^0.12.0
 * [react-tools](https://www.npmjs.com/package/react-tools) - to compile JSX to JS
 * [Handlebars](https://www.npmjs.com/package/handlebars) - to render the initial `<html>` template
 * [Browserify](http://browserify.org) - to re-use our code on server + browser

Our code structure will look like this:

```
- browser       # Browser side logic
- common
  - components  # All our react components
  - controllers # Business logic
- lib
  - components  # Our jsx-compiled components
- public
  - js          # Bundled javascript here
- server
  - templates   # Server side Handlebars templates
```

### Server side rendering

Unlike most React rendering tutorials out there, we will be using the
`React.renderToString` method to generate our DOM. But first, let's start with a
simple component:

```javascript
// file: common/components/todo-item.js
var React = require('react');

module.exports = React.createClass({
  displayName: 'TodoItem',

  getInitialState: function() {
    return { done: this.props.done }
  },

  render: function() {
    return (
      <label>
        <input type="checkbox" defaultChecked={this.state.done} />
        {this.props.name}
      </label>
    );
  }
});
```

Two important points to note here:

 1. We're using CommonJS style `require`'s to include the `React` dependency. We
    will keep this consistent throughout our code, and rely on Browserify to
    convert that into a browser-compatible version during build time. (See
    [Browser Side Rendering](#browser-side-rendering) below for more)
 2. We use `defaultChecked` instead of `checked` property as React would treat
    `checked` as a static property that won't change again. The checkbox
    *should* be changeable, and so we only want to set the initial default.

Before we can use the component, we need to convert that JSX into JS using
React's tooling:

```bash
$ ./node_modules/.bin/jsx common/components/ lib/components/
```

*(This command can be executed with `npm run jsx` in the example repo)*

This assumes you have installed the [jsx
compiler](https://facebook.github.io/react/jsx-compiler.html) with npm using
`npm install --save react-tools`. The converted component will be saved in
`lib/components/todo-item.js`

Now, let's render that component on the server:

```javascript
// file: server/index.js
var React = require('react');
var TodoItem = require('../lib/components/todo-item');

// Since we're not using JSX here, we need to wrap the component in a factory
// manually. See https://gist.github.com/sebmarkbage/ae327f2eda03bf165261
var TodoItemFactory = React.createFactory(TodoItem);

var renderedComponent = React.renderToString(
  TodoItemFactory({done: false, name: 'Write Tutorial'})
);
```

`renderedComponent` at this point will be the rendered HTML (cleaned up a
little to add whitespace):

```html
<label data-reactid=".e8wbttvlkw" data-react-checksum="-1336527625">
  <input type="checkbox" data-reactid=".e8wbttvlkw.0">
  <span data-reactid=".e8wbttvlkw.1">Write Tutorial</span>
</label>
```

*(Note: it is the `data-reactid` and `data-react-checksum` identifiers injected
into the rendered output which is where React gets its magic from. From now on,
should never have to worry about them other than to know they're important)*

As React can't handle rendering `<!doctype>` tags, conditional comments (for
targeting IE), etc, we have to offload that layout rendering task to Handlebars.
Here's our simple HTML5 template file:

```html
<!-- file: server/templates/layout.handlebars -->
<!doctype html>
<html lang="">
  <body>
    <div id="content">{{{content}}}</div>
  </body>
</html>
```

*(Note: There is no white space between the `<div>` and the placeholder
`{{{content}}}` on purpose. See the [Gotchyas](#gotchyas) section for more.)*

Our goal is to inject the rendered component into the `{{{content}}}` tag. Back
in the `server/index.js` file, let's do that:

```javascript
// file: server/index.js

// [...]

var renderedComponent = // [...]

var Handlebars = require('handlebars');
var fs = require('fs');

var fileData = fs.readFileSync(__dirname + '/templates/layout.handlebars').toString();
var layoutTemplate = Handlebars.compile(fileData);

var renderedLayout = layoutTemplate({
  content: renderedComponent
});
```

Excellent, now we have our rendered HTML which will look something like this
(again with some whitespace added):

```html
<!doctype html>
<html lang="">
  <body>
    <div id="content"><label data-reactid=".e8wbttvlkw" data-react-checksum="-1336527625">
      <input type="checkbox" data-reactid=".e8wbttvlkw.0">
      <span data-reactid=".e8wbttvlkw.1">Write Tutorial</span>
    </label></div>
  </body>
</html>
```

Finally for the server side, we need to get this rendered markup to the browser:

```javascript
// file: server/index.js

// [...]

var renderedLayout = // [...]

var app = require('express')();

app.get('/', function(req, res) {
  res.send(renderedLayout);
});

app.listen(3000, function() {
  console.log("Listening on port 3000");
});
```

Excellent, let's test it out:

```bash
$ node server/index.js
Listening on port 3000
```

Load up your favourite modern browser, and point it to `http://localhost:3000`,
then inspect the source code. You should see the example HTML output as above.

### Browser side rendering

Now, let's hook up React on the browser side to re-use the already rendered
components!

Let's start with how we expect the browser code to work, and go backwards from
there:

```javascript
// file: browser/index.js
var React = require('react');
var TodoItem = require('../lib/components/todo-item');

// Since we're not using JSX here, we need to wrap the component in a factory
// manually. See https://gist.github.com/sebmarkbage/ae327f2eda03bf165261
var TodoItemFactory = React.createFactory(TodoItem);

var renderTarget = document.getElementById('content')

// Note the identical state to server/index.js
var renderedComponent = React.render(
  TodoItemFactory({done: false, name: 'Write Tutorial'}),
  renderTarget
);
```

If you're thinking that looks suspiciously like our server side rendering code
in `server/index.js`, you'd be right! This is why React is so powerful -
(almost) the same code works both server and browser side. Although, do note the
difference that we are using `React.render()` here (instead of
`React.renderToString()`) which requires us to pass a DOM element as the render
target.

But, what about using `require` in the browser? Browserify to the rescue!

```bash
./node_modules/.bin/browserify browser/index.js -d > public/js/bundle.js
```

*(This command can be executed with `npm run bundle` in the example repo)*

Add the generated `public/js/bundle.js` to the template:

```html
<!-- file: server/templates/layout.handlebars -->
<!doctype html>
<html lang="">
  <body>
    <div id="content">{{{content}}}</div>
    <script src="js/bundle.js"></script>
  </body>
</html>
```

Now, if we load up our example (with `node server/index.js`), the HTML will be
rendered server side, and React will intelligently pick it up on the browser
side without disrupting the DOM (since the state hasn't changed).

Hurray!

## Gotchyas

### Space is important

In `server/templates/layout.handlebars` note a lack of space between the `<div>`
and the `<label>`. This is because when React checks for differences in the DOM,
it will see a DOM TextNode consisting of just newline or space characters (e.g;
`\n` or ` `) as a valid difference, and so will re-render the entire component.

That is to say; given the following rendered DOM string:

```html
<div id="content"><label data-reactid=".e8wbttvlkw" data-react-checksum="-1336527625">...</label></div>
```

Is considered by React to be different to:

```html
<div id="content">
<label data-reactid=".e8wbttvlkw" data-react-checksum="-1336527625">...</label>
</div>
```

### State change and slow loading Javascript

When the user is on a slow connection (mobile, for example), the
`public/js/bundle.js` script file may take some time to download. During this
time, the user is already presented with the form and can begin interacting with
the checkbox.

Unfortunately, if the user toggles the checkbox to `checked`, when React renders
the DOM, it will not detect the changed state, instead using the passed in state
as the source of truth (as it rightly should).

React has us covered here again with the [`componentDidMount()`
method](https://facebook.github.io/react/docs/component-specs.html#mounting-componentdidmount)
which is executed immediately after rendering, but before returning from the
`.render()` method.

We can leverage this lifecycle method to double check that what's in the DOM and
the current state match up:

```javascript
// file: common/components/todo-item.js
var React = require('react');

module.exports = React.createClass({
  
  // [...]

  componentDidMount: function() {
    this.setState({done: this.refs.done.getDOMNode().checked});
  }

  render: function() {
    return (
      <label>
        <input ref="done" type="checkbox" defaultChecked={this.state.done} />
        {this.props.name}
      </label>
    );
  }
});
```

We're also using another concept called
[`refs`](https://facebook.github.io/react/docs/more-about-refs.html) which allow
us to directly reference an internal React node within the rendered component.
From this, we update the state using the DOM Node's `checked` attribute.

See [Part 3](https://github.com/jesstelford/react-testing-isormorphic) for unit
testing this gotchya.

To emulate this case yourself, you can wrap the contents of `browser/index.js`
in a `setTimeout()` then inspect the state of `renderedComponent.state` after
rendering. If you toggle the checkbox before the timeout, you should see the
component's state has been updated intelligently upon render.

### The Checksum id changes

Every time a React component is instantiated then rendered to string, you will receive a different `data-react-checksum`. This is expected behavior - the browser rendering does not rely solely on this id being the same.

See more in [#3](https://github.com/jesstelford/react-isomorphic-boilerplate/issues/3).

## Part 2

Keep reading Part 2: [Unit testing React Components with Mocha + jsdom](https://github.com/jesstelford/react-testing-mocha-jsdom)
