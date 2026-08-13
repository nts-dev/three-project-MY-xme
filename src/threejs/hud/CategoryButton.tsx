
import React from 'react';
import { Button } from 'primereact/button';
import useGame from "../../hooks/useGame";

export default function CategoryButton() {
    const setCategory = useGame((state: any) => state.setCategory);
    const projectId: number = useGame((state: any) => state.projectID)
    const onButtonClick = () =>{
        setCategory(true)
    }
    if(projectId==0){
        return null
    }

    return (
        <div className="category-button">
            <Button onClick={onButtonClick}
                    tooltip="Show Categories"
                    className='b-category'
            >
                Categories
                {/*<i className="pi pi-align-left visible-element" style={{fontSize: '1rem'}} title="Categories"></i>*/}
            </Button>
        </div>
    )
}

