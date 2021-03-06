import React from 'react';
import {connect} from 'react-redux';
import {Row, Col, ListGroup, ButtonGroup, Button, OverlayTrigger, Popover} from 'react-bootstrap';
import * as d3 from 'd3';

import ProgramButtonGroup from '../ProgramButtonGroup/';

import style from './style.css';

function MB(bytes){
	return Math.round(bytes / 10000) / 100
}

class DeviceGraph extends React.Component {
	constructor(props){
		super();

		this.$dash = props.dash;
		this.engine = props.engine;
		this.d3 = {};
		this.handlers = {};

		this.state = {
			'view_mode': 'cpu',
			'engine_cpu': [],
			'engine_memory': [],
			'plots': {}
		};

		this.max_memory = 50;
	}

	__init_d3(){
		var svg = d3.select(this.refs.graph).append('svg')
			.attr('width', (this.props.width || '600px') )
			.attr('height', (this.props.height || '400px') );
		var elemBox = svg.node().getBoundingClientRect();

		var margin = { left: 50, right: 30, top: 30, bottom: 50 };
		var size = { width: elemBox.width - margin.left - margin.right, height: elemBox.height - margin.top - margin.bottom };

		var axes = svg.append('g').attr('transform', 'translate('+margin.left+', '+margin.top+')');
		var x = d3.scaleLinear().range([ 0, size.width ]);

		if (this.engine.stats.length > 0){
			x.domain([ this.engine.stats[0].timestamp, this.engine.stats[this.engine.stats.length-1].timestamp ]);
		}
		else {
			x.domain([ Date.now() - 1000, Date.now() ]);
		}

		var y = d3.scaleLinear().domain([ 0, 100 ]).range([ size.height, 0 ]);
		var xAxis = d3.axisBottom(x).ticks(Math.floor(elemBox.width / 100)).tickFormat(d3.timeFormat('%H:%M:%S.%L'));
		var yAxis = d3.axisLeft(y);

		var xLine = axes.append('g').attr('transform', 'translate(0, '+size.height+')').call(xAxis);
		var yLine = axes.append('g').call(yAxis);

		var grid = svg.append('g').attr('transform', 'translate('+margin.left+', '+margin.top+')');
		
		var mouseTrack = grid.append('line')
			.attr('x1', 0)
			.attr('x2', 0)
			.attr('y1', 0)
			.attr('y2', size.height)
			.attr('style', 'stroke: rgb(220,180,180); stroke-width: 1;');
		var mouseText = grid.append('text')
			.attr('x', 0)
			.attr('y', 0);

		var mouseCursor = grid.append('line')
			.attr('x1', 0)
			.attr('x2', 0)
			.attr('y1', 0)
			.attr('y2', size.height);
		var cursorText = grid.append('text').attr('x',0).attr('y',0)

		svg.on('mousemove', ()=>{
				var mousePos = d3.mouse(grid.node());
				var timestamp = d3.timeFormat('%H:%M:%S.%L')(x.invert(mousePos[0]));
				// console.log(mousePos);
				mouseTrack.attr('x1', mousePos[0]).attr('x2', mousePos[0]);
				mouseText.attr('x', mousePos[0])
					.text(timestamp);
			});
		svg.on('mouseup', ()=>{
				var mousePos = d3.mouse(grid.node());
				this.d3.cursorAt = x.invert(mousePos[0]);
				// console.log(mousePos, Math.floor(x.invert(mousePos[0])));
				mouseCursor.attr('x1', mousePos[0]).attr('x2', mousePos[0])
					.attr('style', 'stroke: rgb(100,100,255); stroke-width: 2;');
				cursorText.attr('x', mousePos[0]).text(d3.timeFormat('%H:%M:%S.%L')(this.d3.cursorAt));
			});

		// Actual elements that will represent incoming data
		var graph = svg.append('g').attr('transform', 'translate('+margin.left+', '+margin.top+')');
		var realTimeFunc = this.d3.lineFunc = d3.line()
				.x(function(d, i){ return x(d.timestamp) })
				.y(function(d, i){ return y(d.value)})

		var colors = d3.scaleOrdinal(d3.schemeCategory10);

		this.d3.svg = svg;
		this.d3.elemBox = elemBox;
		this.d3.margin = margin;
		this.d3.size = size;
		this.d3.view = { from: 0, to: 0 };
		this.d3.axes = axes;
		this.d3.xScale = x;
		this.d3.yScale = y;
		this.d3.xAxis = xAxis;
		this.d3.yAxis = yAxis;
		this.d3.xLine = xLine;
		this.d3.yLine = yLine;
		this.d3.grid = grid;
		this.d3.cursor = mouseCursor;
		this.d3.cursorText = cursorText;

		this.d3.panLeft = ()=>{
			var domain = x.domain();
			var zoom = domain[1] - domain[0];
			var panStep = zoom * 0.1;
			this.d3.view.from = domain[0] - panStep;
			this.d3.view.to = this.d3.view.from + zoom;
			this.__redraw_d3()
		}
		this.d3.panRight = ()=>{
			var domain = x.domain();
			var zoom = domain[1] - domain[0];
			var panStep = zoom * 0.1;
			this.d3.view.from = domain[0] + panStep;
			this.d3.view.to = this.d3.view.from + zoom;
			this.__redraw_d3()
		}
		this.d3.zoomIn = ()=>{
			var domain = x.domain();
			var zoom = (domain[1] - domain[0]) * 0.8;
			var panStep = zoom * 0.1;
			this.d3.view.from = domain[0] + (domain[1] - domain[0] - zoom) / 2;
			this.d3.view.to = this.d3.view.from + zoom;
			this.__redraw_d3()
		}
		this.d3.zoomOut = ()=>{
			var domain = x.domain();
			var zoom = (domain[1] - domain[0]) / 0.8;
			var panStep = zoom * 0.1;
			this.d3.view.from = domain[0] - (zoom - domain[1] + domain[0]) / 2;
			this.d3.view.to = this.d3.view.from + zoom;
			this.__redraw_d3()
		}
		this.d3.resetView = ()=>{
			this.d3.view.from = 0;
			this.d3.view.to = 0;
			this.__redraw_d3()
		}

		this.d3.graph = graph;
		this.d3.colors = colors;
		this.d3.lines = {};

		var procs = this.engine.getProcesses();
		var plots = {};

		procs.forEach((proc, index)=>{
			// if (proc.status !== 'Exited'){
			plots[proc.instance_id] = this.props.programs[proc.instance_id].stats.slice();

			var procData = plots[proc.instance_id].map((item)=>{
				return { timestamp: item.timestamp, value: item.cpu }
			});

			this.d3.lines[proc.instance_id] = graph.append('path')
										.attr('d', this.d3.lineFunc(procData))
										.attr('stroke', colors(index))
										.attr('stroke-width', 2)
										.attr('fill', 'none');
			// }
		});

		this.state.plots = plots;

		var engineData = this.state.engine_cpu = this.engine.stats.map((item)=>{
			return { timestamp: item.timestamp, value: item.cpu };
		})
		this.state.engine_memory = this.engine.stats.map((item)=>{
			return { timestamp: item.timestamp, value: MB(item.memory.heapUsed) };
		})

		var realTimeLine = this.d3.engineLine = graph.append('path')
			.attr('d', realTimeFunc(engineData))
			.attr('stroke', 'red')
			.attr('stroke-width', 2)
			.attr('fill', 'none')
			// .attr('transform', 'translate('+margin.left+', '+margin.top+')')
	}

	__redraw_d3_grid(){
		var vlines = this.d3.grid.selectAll('.grid-vline')
			.data(this.d3.xScale.ticks());

		vlines.attr('x1', (d)=>{ return this.d3.xScale(d) })
			.attr('x2', (d)=>{ return this.d3.xScale(d) });
		vlines.exit().remove();
		vlines.enter()
			.append('line')
			.attr('class', 'grid-vline')
			.attr('x1', (d)=>{ return this.d3.xScale(d) })
			.attr('x2', (d)=>{ return this.d3.xScale(d) })
			.attr('y1', 0)
			.attr('y2', this.d3.size.height)
			.attr('style', 'stroke: rgb(210,210,210); stroke-width: 1;');

		var hlines = this.d3.grid.selectAll('.grid-hline')
			.data(this.d3.yScale.ticks());

		hlines.attr('y1', (d)=>{ return this.d3.yScale(d) })
			.attr('y2', (d)=>{ return this.d3.yScale(d) });
		hlines.exit().remove();
		hlines.enter()
			.append('line')
			.attr('class', 'grid-hline')
			.attr('x1', 0)
			.attr('x2', this.d3.size.width)
			.attr('y1', (d)=>{ return this.d3.yScale(d) })
			.attr('y2', (d)=>{ return this.d3.yScale(d) })
			.attr('style', 'stroke: rgb(210,210,210); stroke-width: 1;');

		// update mouse cursor position (x domain changed, so the position needs to be updated)
		if (this.d3.cursorAt){
			var cursorAt = this.d3.xScale(this.d3.cursorAt);
			this.d3.cursor.attr('x1', cursorAt).attr('x2', cursorAt)
				.attr('style', 'stroke: rgb(100,100,255); stroke-width: 2;');
			this.d3.cursorText.attr('x', cursorAt);
		}
	}

	__redraw_d3(){
		if (this.state.view_mode === 'cpu'){
			// console.log('Redrawing ', this.state);
			if (this.state.engine_cpu.length > 0){
				if (this.d3.view.from === 0 || this.d3.view.to === 0){
					this.d3.xScale.domain(d3.extent(this.state.engine_cpu, function(d){ return d.timestamp }));
				}
				else {
					this.d3.xScale.domain([this.d3.view.from, this.d3.view.to]);
				}
			}
			else {
				this.d3.xScale.domain([ Date.now() - 1000, Date.now() ]);
			}
			this.d3.yScale.domain([ 0, 100 ]);
			this.d3.yAxis.tickFormat((d)=>(d+' %'));

			this.__redraw_d3_grid();

			Object.keys(this.d3.lines).forEach((instance_id)=>{
				var lineData = this.state.plots[instance_id].map((item)=>{ return { 'timestamp': item.timestamp, value: item.cpu } });
				this.d3.lines[instance_id]
					.datum(lineData)
					.attr('d', this.d3.lineFunc);
			})

			this.d3.engineLine.datum(this.state.engine_cpu)
				.attr('d', this.d3.lineFunc);
		}
		else if (this.state.view_mode === 'memory'){
			if (this.state.engine_memory.length > 0){
				if (this.d3.view.from === 0 || this.d3.view.to === 0){
					this.d3.xScale.domain(d3.extent(this.state.engine_memory, function(d){ return d.timestamp }));
				}
				else {
					this.d3.xScale.domain([this.d3.view.from, this.d3.view.to]);
				}
			}
			else {
				this.d3.xScale.domain([ Date.now() - 1000, Date.now() ]);
			}
			this.d3.yScale.domain([ 0, this.max_memory * 1.1 ]);
			this.d3.yAxis.tickFormat((d)=>(d+' MB'));

			this.__redraw_d3_grid();

			Object.keys(this.d3.lines).forEach((instance_id)=>{
				var lineData = this.state.plots[instance_id].map((item)=>{ return { 'timestamp': item.timestamp, value: MB(item.memory.heapUsed) } });
				this.d3.lines[instance_id]
					.datum(lineData)
					.attr('d', this.d3.lineFunc);
			})

			this.d3.engineLine.datum(this.state.engine_memory)
				.attr('d', this.d3.lineFunc);
		}
		
		this.d3.xLine
			// .transition()
			// .duration(250)
			// .ease(d3.easeLinear,2)
			.call(this.d3.xAxis);
		
		this.d3.yLine
			// .transition()
			// .duration(500)
			// .ease(d3.easeLinear,2)
			.call(this.d3.yAxis);
	}

	componentDidMount(){
		console.log('DeviceGraph MOUNTED');
		this.__init_d3();

		// subscribe to program events
		this.programEvents = this.$dash.on('program-monitor-event', (program)=>{
			console.log('[DeviceGraph] Program Event', program, this.engine);
			if ((program.engine === this.engine) 
				&& !(program.id in this.handlers)){
				this.handlers[program.id] = program.on('resource-report', (data)=>{
					var memory = MB(data.memory.heapUsed);
					if (memory > this.max_memory) this.max_memory = memory;

					var state = {
						plots: Object.assign({}, this.state.plots)
					}
					if (!state.plots[program.id]) state.plots[program.id] = [];
					else state.plots[program.id] = this.state.plots[program.id].concat([ data ])
					// console.log('New Process Data', data);
					
					this.setState(state);
				});

				// plots[program.id] = program.stats.slice();
				var plot = program.stats.slice();
				this.state.plots[program.id] = plot;

				if (!(program.id in this.d3.lines)){
					var procData = plot.map((item)=>{
						return { timestamp: item.timestamp, value: item.cpu }
					});
					this.d3.lines[program.id] = this.d3.graph.append('path')
												.attr('d', this.d3.lineFunc(procData))
												.attr('stroke', this.d3.colors(Object.keys(this.state.plots).length))
												.attr('stroke-width', 2)
												.attr('fill', 'none');
				}
				
				this.setState({});	
			}
			else if ((program.engine !== this.engine)
				&& (program.id in this.state.plots)){
				program.removeHandler('resource-report', this.handlers[program.id]);
				delete this.handlers[program.id];
				// delete this.d3.lines[program.id];
				// delete this.state.plots[program.id];
				this.setState({});
			}
			// this.__init_d3();
			// this.__redraw_d3();
			// this.setState({});
		});

		this.handlerID = this.engine.on('resource-report', (data)=>{
			// console.log(data.timestamp+'    CPU: '+data.cpu+'    MEMORY: '+data.memory.heapUsed);
			var memory = MB(data.memory.heapUsed);
			if (memory > this.max_memory) this.max_memory = memory;

			this.setState({
				engine_cpu: this.state.engine_cpu.concat([{
					timestamp: data.timestamp,
					value: data.cpu
				}]),
				engine_memory: this.state.engine_memory.concat([{
					timestamp: data.timestamp,
					value: memory
				}])
			});
		});

		var procs = this.engine.getProcesses();
		procs.forEach((proc)=>{
			if (proc.status !== 'Exited'){
				var handlerID = this.props.programs[proc.instance_id].on('resource-report', (data)=>{
					var memory = MB(data.memory.heapUsed);
					if (memory > this.max_memory) this.max_memory = memory;

					var state = {
						plots: Object.assign({}, this.state.plots)
					}
					if (!state.plots[proc.instance_id]) state.plots[proc.instance_id] = [];
					else state.plots[proc.instance_id] = this.state.plots[proc.instance_id].concat([ data ])
					// console.log('New Process Data', data);
					
					this.setState(state);
				});
				this.handlers[proc.instance_id] = handlerID;
			}
		});
	}

	componentDidUpdate(prevProps){
		// console.log('DeviceGraph UPDATED', prevProps);
		this.__redraw_d3();
	}

	componentWillUnmount(){
		// clearInterval(this.timer);
		this.engine.removeHandler('resource-report', this.handlerID);
		this.$dash.removeHandler('program-monitor-event', this.programEvents);
		Object.keys(this.handlers).forEach((instance_id)=>{
			this.props.programs[instance_id].removeHandler('resource-report', this.handlers[instance_id]);
		})

		console.log('DeviceGraph WILL UNMOUNT');
	}

	setViewMode(mode){
		this.setState({
			view_mode: mode
		});
	}

	render(){
		return (
			<Row>
				<Col xs={12} md={9}>
					<div ref="graph"></div>
					<div className="text-center">
						<ButtonGroup>
							<Button onClick={(evt)=>this.d3.panLeft(this)}>
								<i className="fa fa-chevron-left"/>
							</Button>
							<Button onClick={(evt)=>this.d3.zoomOut(this)}>
								<i className="fa fa-search-minus"/>
							</Button>
							<Button onClick={(evt)=>this.d3.resetView(this)}>
								<i className="fa fa-refresh"/>
							</Button>
							<Button onClick={(evt)=>this.d3.zoomIn(this)}>
								<i className="fa fa-search-plus"/>
							</Button>
							<Button onClick={(evt)=>this.d3.panRight(this)}>
								<i className="fa fa-chevron-right"/>
							</Button>
						</ButtonGroup>
					</div>
				</Col>
				<Col xs={12} md={3}>
					<ButtonGroup>
						<Button onClick={(e)=>this.setViewMode('cpu')}>CPU</Button>
						<Button onClick={(e)=>this.setViewMode('memory')}>Memory</Button>
					</ButtonGroup>

					<ListGroup componentClass="div">
						<div className="list-group-item graph-legend-item">
							<span className="graph-legend-item-bar" style={{ background: 'red' }}></span>
							Engine
						</div>
						{
							Object.keys(this.state.plots).map((instance_id, index)=>{
								var program = this.props.programs[instance_id];
								if (program.engine === this.engine){
									var popover = (
										<Popover id="popover-device-menu" title={program.instance_id}>
											<ProgramButtonGroup program={program}/>
										</Popover>
									)
									return (
										<OverlayTrigger key={index} trigger="click" placement="bottom" overlay={popover} rootClose>
											<div className={"list-group-item graph-legend-item program-status-"+program.status.toLowerCase()}>
												<span className="graph-legend-item-bar"
													 style={{ background: this.d3.colors(index) }}></span>
												<span>{program.code_name} <small>{instance_id}</small></span>
											</div>
										</OverlayTrigger>
									)
								}
								else {
									return (
										<div key={index} className={"list-group-item graph-legend-item program-status-exited"}>
											<span className="graph-legend-item-bar"
												 style={{ background: this.d3.colors(index) }}></span>
											<span>{program.code_name} <small>{instance_id}</small></span>
										</div>
									)
								}
							})
						}
					</ListGroup>

				</Col>
			</Row>
		)
	}
}

const mapStateToProps = (state)=>{
	return {
		engines: state.dashboard.engines,
		programs: state.dashboard.programs,
	}
}
const mapDispatchToProps = (dispatch)=>{
	return {

	}
}

export default connect(mapStateToProps, mapDispatchToProps)(DeviceGraph);