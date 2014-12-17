/* ----------
 * Rendering our component server side
 */
var React = require('react');
var TodoItem = require('../lib/components/todo-item');

// Since we're not using JSX here, we need to wrap the component in a factory
// manually. See https://gist.github.com/sebmarkbage/ae327f2eda03bf165261
var TodoItemFactory = React.createFactory(TodoItem);

var renderedComponent = React.renderToString(
  TodoItemFactory({done: false, name: 'Write Tutorial'})
);



/* ----------
 * Injecting the rendered component in the Handlebars template
 */
var Handlebars = require('handlebars');
var fs = require('fs');

var fileData = fs.readFileSync(__dirname + '/templates/layout.handlebars').toString();
var layoutTemplate = Handlebars.compile(fileData);

var renderedLayout = layoutTemplate({
  content: renderedComponent
});



/* ----------
 * Serving up the rendered template
 */
var express = require('express');
var app = express();

app.get('/', function(req, res) {
  res.send(renderedLayout);
});

// NOTE: This route is last since we want to match the dynamic routes above
// first before attempting to match a static resource (js/css/etc)
app.use(express.static('./public'));

app.listen(3000, function() {
  console.log("Listening on port 3000");
});
