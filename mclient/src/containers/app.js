import React from 'react'
import {
	Container, connectToHarmowareVis, HarmoVisLayers, MovesLayer, MovesInput,
	LoadingIcon, FpsDisplay, DepotsLayer, EventInfo, MovesbaseOperation, MovesBase, BasedProps
} from 'harmoware-vis'

import HeatmapLayer from './HeatmapLayer'
// import './App.scss';

// import { StaticMap,  } from 'react-map-gl';
import { Layer } from '@deck.gl/core'
import DeckGL from '@deck.gl/react'
import {GeoJsonLayer, LineLayer} from '@deck.gl/layers'

import {_MapContext as MapContext, InteractiveMap, NavigationControl} from 'react-map-gl'

import Controller from '../components/controller'

import * as io from 'socket.io-client'

const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN // Acquire Mapbox accesstoken

class App extends Container {
	constructor (props) {
		super(props)
		const { setSecPerHour, setLeading, setTrailing } = props.actions
		setSecPerHour(3600)
		setLeading(3)
		setTrailing(3)
		const socket = io()
		this.state = {
			moveDataVisible: true,
			moveOptionVisible: false,
			depotOptionVisible: false,
			heatmapVisible: false,
			optionChange: false,
			mapbox_token: '',
			geojson: null,
			lines: [],
			viewState: {
				longitude: 136.8163486 ,
				latitude: 34.8592285,
				zoom: 17,
				bearing: 0,
				pitch: 0,
				width: 500,
				height: 500
			},
			linecolor: [0,155,155],
			popup: [0, 0, '']
		}

		this._onViewStateChange = this._onViewStateChange.bind(this)

		// for receiving event info.
		socket.on('connect', () => { console.log('Socket.IO connected!') })
		socket.on('event', this.getEvent.bind(this))
		socket.on('geojson', this.getGeoJson.bind(this))
		socket.on('lines', this.getLines.bind(this))
		socket.on('agents', this.getAgents.bind(this))
		socket.on('viewstate', this.getViewState.bind(this))

		socket.on('mapbox_token', (token) => {
			console.log('Token Got:' + token)
			this.setState({ mapbox_token: token })
		})

		socket.on('disconnect', () => { console.log('Socket.IO disconnected!') })
	}

	bin2String (array) {
		return String.fromCharCode.apply(String, array)
  	}

	getGeoJson (data) {
		console.log('Geojson:' + data.length)
		console.log(data)
		this.setState({ geojson: JSON.parse(data) })
	}

	getViewState (data) {
		console.log('setViewState:' + data)
		let vs = JSON.parse(data)
		console.log('vs:',vs)
		if (vs.pitch == undefined){
			vs.pitch = 0.0
		}
		this.setState({
			viewState: {
				latitude: vs.lat,
				longitude: vs.lon,
				zoom: vs.zoom,
				pitch: vs.pitch
			}
		})

// 		this.map.getMap().flyTo({ center: [vs.Lon, vs.Lat], zoom:vs.Zoom, pitch: vs.Pitch })

	}

	getLines (data) {
		console.log('getLines!:' + data.length)
// 		console.log(data)
		if (this.state.lines.length > 0) {
			const ladd = JSON.parse(data)
			const lbase = this.state.lines
			const lists = lbase.concat(ladd)
			this.setState({ lines: lists })
		} else {
			this.setState({ lines: JSON.parse(data) })
		}
	}

	getAgents (data) {
		const { actions, movesbase } = this.props
// 		console.log(data)
// 		console.log('DT')
		const dt = JSON.parse(data)
		const agents = dt.dt.agents
// 		console.log(dt)
// 		console.log(agents)

		const time = dt.ts // set time as now. (If data have time, ..)
// 		let hit = false;
// 		const movesbasedata = [...movesbase]; // why copy !?
		let  setMovesbase = []

		if (movesbase.length == 0) {
// 			console.log("Initial!:" + agents.length)
			for (let i = 0, len = agents.length; i < len; i++) {
				setMovesbase.push({
					mtype: 0,
					id: i,
					departuretime: time,
					arrivaltime: time,
					operation: [{
						elapsedtime: time,
						position: [agents[i].point[0], agents[i].point[1], 0],
						angle: 0,
						speed: 0.5,
						color: [100,100,0]
					}]
				})
			}
// we may refresh viewport

		} else {
// 			console.log("Aget Update!" + data.length+":"+ agents[0])
			for (let i = 0, lengthi = movesbase.length; i < lengthi; i ++) {
				movesbase[i].arrivaltime = time
				movesbase[i].operation.push({
					elapsedtime: time,
					position: [agents[i].point[0], agents[i].point[1], 0],
					angle: 0,
					color: [100,100,0],
					speed: 0.5
				})
// 				setMovesbase.push(movesbase[i]);
			}
			setMovesbase = movesbase
		}

		actions.updateMovesBase(setMovesbase)
	}

	getEvent (socketData) {
		const { actions, movesbase } = this.props
		const { mtype, id, lat, lon, angle, speed } = JSON.parse(socketData)
		// 	console.log("dt:",mtype,id,time,lat,lon,angle,speed, socketData);
		const time = Date.now() / 1000 // set time as now. (If data have time, ..)
		let hit = false
		const movesbasedata = [...movesbase] // why copy !?
		const setMovesbase = []

		for (let i = 0, lengthi = movesbasedata.length; i < lengthi; i += 1) {
			// 	    let setMovedata = Object.assign({}, movesbasedata[i]);
			let setMovedata = movesbasedata[i]
			if (mtype === setMovedata.mtype && id === setMovedata.id) {
				hit = true
				// 		const {operation } = setMovedata;
				// 		const arrivaltime = time;
				setMovedata.arrivaltime = time
				setMovedata.operation.push({
					elapsedtime: time,
					position: [lon, lat, 0],
					angle, speed
				})
				// 		setMovedata = Object.assign({}, setMovedata, {arrivaltime, operation});
			}
			setMovesbase.push(setMovedata)
		}
		if (!hit) {
			setMovesbase.push({
				mtype, id,
				departuretime: time,
				arrivaltime: time,
				operation: [{
					elapsedtime: time,
					position: [lon, lat, 0],
					angle, speed
				}]
			})
		}
		actions.updateMovesBase(setMovesbase)
	}

	deleteMovebase (maxKeepSecond) {
		const { actions, animatePause, movesbase, settime } = this.props
		const movesbasedata = [...movesbase]
		const setMovesbase = []
		let dataModify = false
		const compareTime = settime - maxKeepSecond

		/*
		for (let i = 0, lengthi = movesbasedata.length; i < lengthi; i += 1) {
			const { departuretime: propsdeparturetime, operation: propsoperation } = movesbasedata[i];
			let departuretime = propsdeparturetime;
			let startIndex = propsoperation.length;
			for (let j = 0, lengthj = propsoperation.length; j < lengthj; j += 1) {
				if (propsoperation[j].elapsedtime > compareTime) {
					startIndex = j;
					departuretime = propsoperation[j].elapsedtime;
					break;
				}
			}
			if (startIndex === 0) {
				setMovesbase.push(Object.assign({}, movesbasedata[i]));
			} else
				if (startIndex < propsoperation.length) {
					setMovesbase.push(Object.assign({}, movesbasedata[i], {
						operation: propsoperation.slice(startIndex), departuretime
					}));
					dataModify = true;
				} else {
					dataModify = true;
				}
		}*/
			if (!animatePause) {
				actions.setAnimatePause(true)
			}
			actions.updateMovesBase(setMovesbase)
			if (!animatePause) {
				actions.setAnimatePause(false)
			}
		console.log('viewState')
// 		console.log(this.map.getMap())
		console.log(this.state.viewState)

// 		this.map.getMap().flyTo({ center: [-118.4107187, 33.9415889] })
// 		console.log(this.state.viewState)
// 		console.log(MapContext.viewport)
	}

	getMoveDataChecked (e) {
		this.setState({ moveDataVisible: e.target.checked })
	}

	getMoveOptionChecked (e) {
		this.setState({ moveOptionVisible: e.target.checked })
	}

	getDepotOptionChecked (e) {
		this.setState({ depotOptionVisible: e.target.checked })
	}

	getOptionChangeChecked (e) {
		this.setState({ optionChange: e.target.checked })
	}

	initialize (gl) {
		gl.enable(gl.DEPTH_TEST)
		gl.depthFunc(gl.LEQUAL)
		console.log('GL Initialized!')
	}

	logViewPort (state,view) {
		console.log('Viewport changed!', state, view)
	}

	handleStyleLoad (map) {
		console.log('StyleLoad:Map',map)
	}

	_onViewStateChange ({viewState}) {
		this.setState({viewState})
	}

	render () {
		const props = this.props
		const { actions, clickedObject, inputFileName, viewport, deoptsData, loading,
			routePaths, lightSettings, movesbase, movedData, mapStyle ,extruded, gridSize,gridHeight, enabledHeatmap, selectedType} = props
		// 	const { movesFileName } = inputFileName;
		const optionVisible = false
		const onHover = (el) => {
			if (el && el.object) {
				let disptext = ''
				const objctlist = Object.entries(el.object)
				for (let i = 0, lengthi = objctlist.length; i < lengthi; i += 1) {
					const strvalue = objctlist[i][1].toString()
					disptext += i > 0 ? '\n' : ''
					disptext += (`${objctlist[i][0]}: ${strvalue}`)
				}
				this.setState({ popup: [el.x, el.y, disptext] })
			} else {
				this.setState({ popup: [0, 0, ''] })
			}
		}
		let layers = []

		if (this.state.geojson != null) {
			layers.push(
			new GeoJsonLayer({
				id: 'geojson-layer',
				data: this.state.geojson,
				pickable: true,
				stroked: false,
				filled: true,
				extruded: true,
				lineWidthScale: 2,
				lineWidthMinPixels: 2,
				getFillColor: [160, 160, 180, 200],
// 				getLineColor: d => colorToRGBArray(d.properties.color),
				getLineColor: [255,255,255],
				getRadius: 1,
				getLineWidth: 1,
				getElevation: 10
// 				onHover: ({object, x, y}) => {
// 				  const tooltip = object.properties.name || object.properties.station;
// 				}
			}))
		}

		if (this.state.lines.length > 0) {
			this.lines = 0
			layers.push(
				new LineLayer({
					visible: true,
					data: this.state.lines,
					getSourcePosition: d => d.from,
					getTargetPosition: d => d.to,
					getColor: this.state.linecolor,
					getWidth: 1.0,
					widthMinPixels: 0.5
				})
			)

		}

		if (this.state.moveDataVisible && movedData.length > 0) {
			layers.push(
				new MovesLayer({
					viewport, routePaths, movesbase, movedData,
					clickedObject, actions, lightSettings,
					visible: this.state.moveDataVisible,
					optionVisible: this.state.moveOptionVisible,
					layerRadiusScale: 0.03,
					layerOpacity: 0.8,
					getRaduis: 0.2,
					getStrokeWidth: 0.1,
					getColor : [0,200,20],
					optionCellSize: 2,
					sizeScale: 20,
					iconChange: false,
					optionChange: false, // this.state.optionChange,
					onHover
				})
			)
		}

		if (enabledHeatmap) {
			layers.push(
				new HeatmapLayer({
					visible: enabledHeatmap,
					type: selectedType,
					extruded,
					movedData,
					size: gridSize,
					height: gridHeight
				  })
			)
		}

		const onViewportChange = this.props.onViewportChange || actions.setViewport
		const {viewState} = this.state

		const mapboxMap = <InteractiveMap
			ref={(e) => { this.map = e }}
			viewport={viewport}
			mapStyle={'mapbox://styles/mapbox/dark-v8'}
			onViewportChange={onViewportChange}
			mapboxApiAccessToken={this.state.mapbox_token}
			visible={true}
// 			onStyleLoad={this.handleStyleLoad}
			>
		</InteractiveMap>

		// wait until mapbox_token is given from harmo-vis provider.
		const visLayer =
			(this.state.mapbox_token.length > 0) ?
				<DeckGL
					viewState = {viewState}
					layers={layers}
					onWebGLInitialized={this.initialize}
					initialViewState={{longitude: 136.8163486 , latitude: 34.8592285, zoom: 17}}
					controller={true}
					ContextProvider={MapContext.Provider}
					onViewStateChange={this._onViewStateChange}
				>
					{mapboxMap}
				</DeckGL>
				: <LoadingIcon loading={true} />

/*					<div style={{ position: "absolute", left: 30, top: 120, zIndex: 1 }}>
						<NavigationControl />
					</div>
				*/

			/*				<InteractiveMap
					viewport={viewport}
					mapStyle={'mapbox://styles/mapbox/dark-v8'}
					onViewportChange={onViewportChange}
					mapboxApiAccessToken={this.state.mapbox_token}
					visible={true}>

					<DeckGL viewState={viewport} layers={layers} onWebGLInitialized={this.initialize} />

				</InteractiveMap>
				: <LoadingIcon loading={true} />;
*/
		return (
			<div>
				<Controller {...props}
					deleteMovebase={this.deleteMovebase.bind(this)}
					getMoveDataChecked={this.getMoveDataChecked.bind(this)}
					getMoveOptionChecked={this.getMoveOptionChecked.bind(this)}
					getDepotOptionChecked={this.getDepotOptionChecked.bind(this)}
					getOptionChangeChecked={this.getOptionChangeChecked.bind(this)}
				/>
				<div className='harmovis_area'>
					{visLayer}
				</div>
				<svg width={viewport.width} height={viewport.height} className='harmovis_overlay'>
					<g fill='white' fontSize='12'>
						{this.state.popup[2].length > 0 ?
							this.state.popup[2].split('\n').map((value, index) =>
								<text
									x={this.state.popup[0] + 10} y={this.state.popup[1] + (index * 12)}
									key={index.toString()}
								>{value}</text>) : null
						}
					</g>
				</svg>

				<FpsDisplay />
			</div>
		)
	}
}
export default connectToHarmowareVis(App)
