import React from 'react';
import {connect} from 'react-redux';
import {Grid, Row, Col, Breadcrumb, Panel, Form, FormGroup, ControlLabel, FormControl, 
		ButtonGroup, Button, ListGroup, ListGroupItem, InputGroup, Image, Badge} from 'react-bootstrap';

import AceEditor from 'react-ace';
import 'brace/mode/javascript';
import 'brace/theme/github';

class FileSystemViewer extends React.Component {
	constructor(props){
		super();

		console.log("FileSystemViewer Component", props);
		this.$dash = props.dash;

		this.state = {
			cur_path: '/',
			cur_path_tokens: [],
			cur_dir: {},
			cur_file: {
	            name: '',
	            content: ''
	        },
			cur_selection: {},
			mkdir_name: ''
		}

	}

	componentDidMount() {
		this.refresh();
	}

	refresh(){
        this.$dash.fs.get(this.state.cur_path)
            .then((fsObject)=>{
                console.log('FSViewer Refreshed', fsObject);
                this.setState({
                	cur_dir: fsObject,
                	cur_path_tokens: this.state.cur_path.split('/').slice(1)
                })
            })
    }

	navigateTo(dir_name){
		var to_path;
		if (dir_name === '..') {
            to_path = '/' + this.state.cur_path_tokens.slice(0, -1).join('/');
        } 
        else if (dir_name[0] === '/') {
            to_path = dir_name;
        }
        else if (this.state.cur_path === '/') {
            to_path = this.state.cur_path + dir_name;
        }
        else {
            to_path = this.state.cur_path + '/' + dir_name;
        }
        console.log(to_path, dir_name, this.state.cur_path)
        this.clearAll();
        this.$dash.fs.get(to_path)
            .then((fsObject)=>{
                console.log(fsObject);
                this.setState({
                	cur_path: to_path,
                	cur_path_tokens: to_path.split('/').slice(1),
                	cur_dir: fsObject
                })
            })
        // this.refresh();
	}

	makeDir(dir_name){
		if(this.state.mkdir_name === ''){
			return;
		}
        this.$dash.fs.makeDir(this.state.cur_path, this.state.mkdir_name)
            .then((dir)=>{
                console.log("directory saved", dir);
                this.setState({ mkdir_name: '' });
                this.refresh();
            });
    }

    saveFile(){
    	if(this.state.cur_file.name === ''){
    		return;
    	}
        this.$dash.fs.writeFile(this.state.cur_path, this.state.cur_file)
            .then((file)=>{
                console.log("file saved", file);
                // this.cur_code._id = file._id;
                this.setState({
                	cur_file: Object.assign(this.state.cur_file, {
                		_id: file._id,
                		name: file.name,
                		content: file.content
                	})
                })
                this.refresh();
            });
    }

    loadFile(file){
    	this.setState({
    		cur_file: {
    			_id: file._id,
    			name: file.name,
    			content: file.content
    		}
    	})
    }

    deleteSelection(){
    	console.log('trying to delete: ' + Object.keys(this.state.cur_selection));
    	this.$dash.fs.delete(this.state.cur_path, Object.keys(this.state.cur_selection))
    		.then((res)=>{
    			this.refresh();
    		});
    }

	clearAll(){
		this.setState({
			cur_file: {
				name: '',
            	content: ''	
			},
			cur_selection: {}
		})
    }
	
	updateFileName(event){
    	this.setState({ cur_file: Object.assign(this.state.cur_file, { name: event.target.value }) });
    	console.log(this.state);
    }

    updateFileContent(content){
    	this.setState({ cur_file: Object.assign(this.state.cur_file, { content: content }) });
    	console.log(this.state);
    }

    updateDirName(event){
    	this.setState({ mkdir_name: event.target.value });
    }

    updateSelection(event, fsObject){
    	event.stopPropagation();
    	var selection = Object.assign({}, this.state.cur_selection);
    	if(event.target.checked){
    		selection[fsObject._id] = null;
    		this.setState({ cur_selection: selection });
    	}
    	else{
    		delete selection[fsObject._id];
    		this.setState({ cur_selection: selection });
    	}
    	console.log(this.state);
    }

	render(){
		var curDirs;
		if (this.state.cur_dir.dirs && this.state.cur_dir.dirs.length > 0){
			curDirs = this.state.cur_dir.dirs.map((name, index)=>{
				var fsObject = this.state.cur_dir.content[name];
				return (
					<ListGroupItem key={index} onClick={(e)=>this.navigateTo(name)}>
							<input 
								type="checkbox"
								onClick={(e)=>this.updateSelection(e, fsObject)}
							/>
							<i className="fa fa-folder"/> {name}
					</ListGroupItem>
					)
			})	
		}
		else {
			curDirs = null;
		}

		var curFiles;
		if (this.state.cur_dir.files && this.state.cur_dir.files.length > 0){
			curFiles = this.state.cur_dir.files.map((name, index)=>{
				var file = this.state.cur_dir.content[name];
				return (
					<ListGroupItem key={index} onClick={(e)=>this.loadFile(file)}>
							<input 
								type="checkbox" 
								onChange={(e)=>this.updateSelection(e, file)}
							/>
							<i className="fa fa-file"/> {name}
					</ListGroupItem>
					)
			})	
		}
		else {
			curFiles = (this.state.cur_dir.dirs && this.state.cur_dir.dirs.length > 0) ? 
				null : (<ListGroupItem className="text-center"> - Empty - </ListGroupItem>)
		}

		return (
			<Row>
				<Col xs={12} md={8}>
					<Breadcrumb>
						<Breadcrumb.Item href="/#/files/"><i className="fa fa-home"></i></Breadcrumb.Item>
						{
							this.state.cur_path_tokens.map((token, index)=>{
								return <Breadcrumb.Item key={index} href="/#/files">{token}</Breadcrumb.Item>
							})
						}
					</Breadcrumb>
					<Form>
						<FormGroup>
							<ControlLabel>Name</ControlLabel>
							<FormControl
								type="text"
								value={this.state.cur_file.name}
								onChange={this.updateFileName.bind(this)}>
							</FormControl>
						</FormGroup>
						<FormGroup>
							<ControlLabel>Content</ControlLabel>
							<AceEditor 
							 	onChange={this.updateFileContent.bind(this)}
								value={this.state.cur_file.content}
								mode="javascript"
								theme="github"
								width="100%"></AceEditor>
						</FormGroup>
						<Button onClick={this.saveFile.bind(this)} bsStyle="primary" block>
							Save
						</Button>
					</Form>
				</Col>
				<Col xs={12} md={4}>
					<Panel>
						<Panel.Heading>
							<Button onClick={this.refresh.bind(this)}>
								<i className="fa fa-refresh"/> Directory
							</Button>
							<Button className="pull-right" onClick={this.clearAll.bind(this)}>
								<i className="fa fa-file"/> Create New 
							</Button>
						</Panel.Heading>
						<Panel.Body>
							<ListGroup>
								{
									(this.state.cur_path === '/' ? null: (
										<ListGroupItem onClick={()=>this.navigateTo("..")}>
											<i className="fa fa-folder"/> ..
										</ListGroupItem>)
									)
								}
								{curDirs}
								{curFiles}

								{/* create a directory */}
								<FormGroup>
								    <InputGroup>
								      	<InputGroup.Button>
								        	<Button onClick={this.makeDir.bind(this)} bsStyle="success" block>
								        		+ <i className="fa fa-folder"/>
								        	</Button>
								      	</InputGroup.Button>
								      	<FormControl 
								      		type="text"
								      		value={this.state.mkdir_name}
								      		onChange={this.updateDirName.bind(this)} 
								      	/>
								    </InputGroup>
								</FormGroup>
							</ListGroup>

							<Button onClick={this.deleteSelection.bind(this)} bsStyle="danger" block>
								<i className="fa fa-trash"/> Delete Selected
							</Button>
						</Panel.Body>
					</Panel>
				</Col>
			</Row>
		)
	}
}

export default FileSystemViewer

// const mapStateToProps = (state)=>{
// 	return {
// 		root: state.dashboard.files
// 	}
// }
// const mapDispatchToProps = (dispatch)=>{
// 	return {

// 	}
// }

// export default connect(mapStateToProps, mapDispatchToProps)(FileSystemViewer);
