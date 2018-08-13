import React from 'react';
import styles from './styles.css';

export default function DeviceGraph(props){
	return (
		<div className='terminal'>
			{
				props.lines.map((line, index)=>{
					return <p key={index}>{line}</p>
				})
			}
		</div>
	)
}