import {
  append as svgAppend,
  attr as svgAttr,
  classes as svgClasses,
  create as svgCreate,
  remove as svgRemove,
  clear as svgClear
} from 'tiny-svg';


var LOW_PRIORITY = 740;

/**
 * Shows a connection preview during element creation.
 *
 * @param {didi.Injector} injector
 * @param {EventBus} eventBus
 * @param {Canvas} canvas
 * @param {GraphicsFactory} graphicsFactory
 * @param {ElementFactory} elementFactory
 */
export default function CreateConnectPreview(
    injector,
    eventBus,
    canvas,
    graphicsFactory,
    elementFactory,
    previewSupport,
    styles
) {
  var connectionDocking = injector.get('connectionDocking', false),
      layouter = injector.get('layouter', false);

  function createConnectPreviewGfx() {
    var gfx = svgCreate('g');

    svgAttr(gfx, {
      'pointer-events': 'none'
    });

    svgClasses(gfx).add('djs-dragger');

    return gfx;
  }

  function createConnectionPreviewGroup() {
    var connectionPreviewGroup = svgCreate('g');

    svgAttr(connectionPreviewGroup, styles.cls('djs-connection-preview-group', [ 'no-events' ]));

    var defaultLayer = canvas.getDefaultLayer();

    svgAppend(defaultLayer, connectionPreviewGroup);

    return connectionPreviewGroup;
  }

  eventBus.on('create.move', LOW_PRIORITY, function(event) {
    var context = event.context,
        connectionPreviewGroup = context.connectionPreviewGroup,
        source = context.source,
        shape = context.shape,
        connectPreviewGfx = context.connectPreviewGfx,
        canExecute = context.canExecute,
        connect = canExecute && canExecute.connect,
        getConnection = context.getConnection,
        connection;

    if (!getConnection) {
      getConnection = context.getConnection = Cacher(function(attrs) {
        return elementFactory.create('connection', attrs);
      });
    }

    if (!connect) {
      return;
    }

    connection = getConnection(connectionAttrs(connect));

    // monkey patch shape position for intersection to work
    shape.x = Math.round(event.x - shape.width / 2);
    shape.y = Math.round(event.y - shape.height / 2);

    if (layouter) {
      connection.waypoints = [];

      connection.waypoints = layouter.layoutConnection(connection, {
        source: source,
        target: shape
      });
    } else {
      connection.waypoints = [
        { x: source.x + source.width / 2, y: source.y + source.height / 2 },
        { x: event.x, y: event.y }
      ];
    }

    if (connectionDocking) {
      connection.waypoints = connectionDocking.getCroppedWaypoints(connection, source, shape);
    }

    // update graphics
    if (connectPreviewGfx) {
      graphicsFactory.update('connection', connection, connectPreviewGfx);
    } else {
      connectPreviewGfx = context.connectPreviewGfx = createConnectPreviewGfx();

      graphicsFactory.drawConnection(connectPreviewGfx, connection);
    }

    if (connectionPreviewGroup) {
      svgClear(connectionPreviewGroup);
    } else {
      connectionPreviewGroup = context.connectionPreviewGroup = createConnectionPreviewGroup();
    }

    previewSupport.addDragger(connection, connectPreviewGfx, connectionPreviewGroup);
  });


  eventBus.on('create.cleanup', function(event) {
    var context = event.context,
        connectionPreviewGroup = context.connectionPreviewGroup;

    if (connectionPreviewGroup) {
      svgRemove(connectionPreviewGroup);
    }
  });

}

CreateConnectPreview.$inject = [
  'injector',
  'eventBus',
  'canvas',
  'graphicsFactory',
  'elementFactory',
  'previewSupport',
  'styles'
];



// helpers //////////////

function connectionAttrs(connect) {

  if (typeof connect === 'boolean') {
    return {};
  } else {
    return connect;
  }
}


function Cacher(createFn) {

  var entries = {};

  return function(attrs) {

    var key = JSON.stringify(attrs);

    var e = entries[key];

    if (!e) {
      e = entries[key] = createFn(attrs);
    }

    return e;
  };
}