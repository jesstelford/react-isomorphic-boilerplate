var React = require('react');
var TodoItem = require('../lib/components/todo-item');

// Since we're not using JSX here, we need to wrap the component in a factory
// manually. See https://gist.github.com/sebmarkbage/ae327f2eda03bf165261
var TodoItemFactory = React.createFactory(TodoItem);

var renderTarget = document.getElementById('content');

// Note the identical state to server/index.js
var renderedComponent = React.render(
  TodoItemFactory({done: false, name: 'Write Tutorial'}),
  renderTarget
);
