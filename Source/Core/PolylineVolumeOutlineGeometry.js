/*global define*/
define([
        './BoundingRectangle',
        './BoundingSphere',
        './Cartesian2',
        './Cartesian3',
        './ComponentDatatype',
        './CornerType',
        './defaultValue',
        './defined',
        './DeveloperError',
        './Ellipsoid',
        './Geometry',
        './GeometryAttribute',
        './GeometryAttributes',
        './IndexDatatype',
        './Math',
        './PolygonPipeline',
        './PolylineVolumeGeometryLibrary',
        './PrimitiveType',
        './WindingOrder'
    ], function(
        BoundingRectangle,
        BoundingSphere,
        Cartesian2,
        Cartesian3,
        ComponentDatatype,
        CornerType,
        defaultValue,
        defined,
        DeveloperError,
        Ellipsoid,
        Geometry,
        GeometryAttribute,
        GeometryAttributes,
        IndexDatatype,
        CesiumMath,
        PolygonPipeline,
        PolylineVolumeGeometryLibrary,
        PrimitiveType,
        WindingOrder) {
    "use strict";

    function computeAttributes(positions, shape) {
        var attributes = new GeometryAttributes();
        attributes.position = new GeometryAttribute({
            componentDatatype : ComponentDatatype.DOUBLE,
            componentsPerAttribute : 3,
            values : positions
        });

        var shapeLength = shape.length;
        var vertexCount = attributes.position.values.length / 3;
        var positionLength = positions.length / 3;
        var shapeCount = positionLength / shapeLength;
        var indices = IndexDatatype.createTypedArray(vertexCount, 2 * shapeLength * (shapeCount + 1));
        var i, j;
        var index = 0;
        i = 0;
        var offset = i * shapeLength;
        for (j = 0; j < shapeLength - 1; j++) {
            indices[index++] = j + offset;
            indices[index++] = j + offset + 1;
        }
        indices[index++] = shapeLength - 1 + offset;
        indices[index++] = offset;

        i = shapeCount - 1;
        offset = i * shapeLength;
        for (j = 0; j < shapeLength - 1; j++) {
            indices[index++] = j + offset;
            indices[index++] = j + offset + 1;
        }
        indices[index++] = shapeLength - 1 + offset;
        indices[index++] = offset;

        for (i = 0; i < shapeCount - 1; i++) {
            var firstOffset = shapeLength * i;
            var secondOffset = firstOffset + shapeLength;
            for (j = 0; j < shapeLength; j++) {
                indices[index++] = j + firstOffset;
                indices[index++] = j + secondOffset;
            }
        }

        var geometry = new Geometry({
            attributes : attributes,
            indices : IndexDatatype.createTypedArray(vertexCount, indices),
            boundingSphere : BoundingSphere.fromVertices(positions),
            primitiveType : PrimitiveType.LINES
        });

        return geometry;
    }

    /**
     * A description of a polyline with a volume (a 2D shape extruded along a polyline).
     *
     * @alias PolylineVolumeOutlineGeometry
     * @constructor
     *
     * @param {Object} options Object with the following properties:
     * @param {Cartesian3[]} options.polylinePositions An array of positions that define the center of the polyline volume.
     * @param {Number} options.shapePositions An array of positions that define the shape to be extruded along the polyline
     * @param {Ellipsoid} [options.ellipsoid=Ellipsoid.WGS84] The ellipsoid to be used as a reference.
     * @param {Number} [options.granularity=CesiumMath.RADIANS_PER_DEGREE] The distance, in radians, between each latitude and longitude. Determines the number of positions in the buffer.
     * @param {CornerType} [options.cornerType=CornerType.ROUNDED] Determines the style of the corners.
     *
     * @see PolylineVolumeOutlineGeometry#createGeometry
     *
     * @demo {@link http://cesiumjs.org/Cesium/Apps/Sandcastle/index.html?src=Polyline%20Volume%20Outline.html|Cesium Sandcastle Polyline Volume Outline Demo}
     *
     * @example
     * function computeCircle(radius) {
     *   var positions = [];
     *   for (var i = 0; i < 360; i++) {
     *     var radians = Cesium.Math.toRadians(i);
     *     positions.push(new Cesium.Cartesian2(radius * Math.cos(radians), radius * Math.sin(radians)));
     *   }
     *   return positions;
     * }
     *
     * var volumeOutline = new Cesium.PolylineVolumeOutlineGeometry({
     *   polylinePositions : Cesium.Cartesian3.fromDegreesArray([
     *     -72.0, 40.0,
     *     -70.0, 35.0
     *   ]),
     *   shapePositions : computeCircle(100000.0)
     * });
     */
    function PolylineVolumeOutlineGeometry(options) {
        options = defaultValue(options, defaultValue.EMPTY_OBJECT);
        var positions = options.polylinePositions;
        var shape = options.shapePositions;

        //>>includeStart('debug', pragmas.debug);
        if (!defined(positions)) {
            throw new DeveloperError('options.polylinePositions is required.');
        }
        if (!defined(shape)) {
            throw new DeveloperError('options.shapePositions is required.');
        }
        //>>includeEnd('debug');

        this._positions = positions;
        this._shape = shape;
        this._ellipsoid = Ellipsoid.clone(defaultValue(options.ellipsoid, Ellipsoid.WGS84));
        this._cornerType = defaultValue(options.cornerType, CornerType.ROUNDED);
        this._granularity = defaultValue(options.granularity, CesiumMath.RADIANS_PER_DEGREE);

        var numComponents = 1 + positions.length * Cartesian3.packedLength;
        numComponents += 1 + shape.length * Cartesian2.packedLength;

        /**
         * The number of elements used to pack the object into an array.
         * @type {Number}
         */
        this.packedLength = numComponents + Ellipsoid.packedLength + 2;
    }

    /**
     * Stores the provided instance into the provided array.
     * @function
     *
     * @param {Object} value The value to pack.
     * @param {Number[]} array The array to pack into.
     * @param {Number} [startingIndex=0] The index into the array at which to start packing the elements.
     */
    PolylineVolumeOutlineGeometry.pack = function(value, array, startingIndex) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(value)) {
            throw new DeveloperError('value is required');
        }
        if (!defined(array)) {
            throw new DeveloperError('array is required');
        }
        //>>includeEnd('debug');

        startingIndex = defaultValue(startingIndex, 0);

        var i;

        var positions = value._positions;
        var length = positions.length;
        array[startingIndex++] = length;

        for (i = 0; i < length; ++i, startingIndex += Cartesian3.packedLength) {
            Cartesian3.pack(positions[i], array, startingIndex);
        }

        var shape = value._shape;
        length = shape.length;
        array[startingIndex++] = length;

        for (i = 0; i < length; ++i, startingIndex += Cartesian2.packedLength) {
            Cartesian2.pack(shape[i], array, startingIndex);
        }

        Ellipsoid.pack(value._ellipsoid, array, startingIndex);
        startingIndex += Ellipsoid.packedLength;

        array[startingIndex++] = value._cornerType;
        array[startingIndex]   = value._granularity;
    };

    var scratchEllipsoid = Ellipsoid.clone(Ellipsoid.UNIT_SPHERE);
    var scratchOptions = {
        polylinePositions : undefined,
        shapePositions : undefined,
        ellipsoid : scratchEllipsoid,
        height : undefined,
        cornerType : undefined,
        granularity : undefined
    };

    /**
     * Retrieves an instance from a packed array.
     *
     * @param {Number[]} array The packed array.
     * @param {Number} [startingIndex=0] The starting index of the element to be unpacked.
     * @param {PolylineVolumeOutlineGeometry} [result] The object into which to store the result.
     */
    PolylineVolumeOutlineGeometry.unpack = function(array, startingIndex, result) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(array)) {
            throw new DeveloperError('array is required');
        }
        //>>includeEnd('debug');

        startingIndex = defaultValue(startingIndex, 0);

        var i;

        var length = array[startingIndex++];
        var positions = new Array(length);

        for (i = 0; i < length; ++i, startingIndex += Cartesian3.packedLength) {
            positions[i] = Cartesian3.unpack(array, startingIndex);
        }

        length = array[startingIndex++];
        var shape = new Array(length);

        for (i = 0; i < length; ++i, startingIndex += Cartesian2.packedLength) {
            shape[i] = Cartesian2.unpack(array, startingIndex);
        }

        var ellipsoid = Ellipsoid.unpack(array, startingIndex, scratchEllipsoid);
        startingIndex += Ellipsoid.packedLength;

        var cornerType = array[startingIndex++];
        var granularity = array[startingIndex];

        if (!defined(result)) {
            scratchOptions.polylinePositions = positions;
            scratchOptions.shapePositions = shape;
            scratchOptions.cornerType = cornerType;
            scratchOptions.granularity = granularity;
            return new PolylineVolumeOutlineGeometry(scratchOptions);
        }

        result._positions = positions;
        result._shape = shape;
        result._ellipsoid = Ellipsoid.clone(ellipsoid, result._ellipsoid);
        result._cornerType = cornerType;
        result._granularity = granularity;

        return result;
    };

    var brScratch = new BoundingRectangle();

    /**
     * Computes the geometric representation of the outline of a polyline with a volume, including its vertices, indices, and a bounding sphere.
     *
     * @param {PolylineVolumeOutlineGeometry} polylineVolumeOutlineGeometry A description of the polyline volume outline.
     * @returns {Geometry} The computed vertices and indices.
     *
     * @exception {DeveloperError} Count of unique polyline positions must be greater than 1.
     * @exception {DeveloperError} Count of unique shape positions must be at least 3.
     */
    PolylineVolumeOutlineGeometry.createGeometry = function(polylineVolumeOutlineGeometry) {
        var positions = polylineVolumeOutlineGeometry._positions;
        var cleanPositions = PolylineVolumeGeometryLibrary.removeDuplicatesFromPositions(positions, polylineVolumeOutlineGeometry._ellipsoid);
        var shape2D = polylineVolumeOutlineGeometry._shape;
        shape2D = PolylineVolumeGeometryLibrary.removeDuplicatesFromShape(shape2D);

        //>>includeStart('debug', pragmas.debug);
        if (cleanPositions.length < 2) {
            throw new DeveloperError('Count of unique polyline positions must be greater than 1.');
        }
        if (shape2D.length < 3) {
            throw new DeveloperError('Count of unique shape positions must be at least 3.');
        }
        //>>includeEnd('debug');

        if (PolygonPipeline.computeWindingOrder2D(shape2D) === WindingOrder.CLOCKWISE) {
            shape2D.reverse();
        }
        var boundingRectangle = BoundingRectangle.fromPoints(shape2D, brScratch);

        var computedPositions = PolylineVolumeGeometryLibrary.computePositions(cleanPositions, shape2D, boundingRectangle, polylineVolumeOutlineGeometry, false);
        return computeAttributes(computedPositions, shape2D);
    };

    return PolylineVolumeOutlineGeometry;
});