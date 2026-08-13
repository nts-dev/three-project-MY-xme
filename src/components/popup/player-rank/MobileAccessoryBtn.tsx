import { Button } from "primereact/button";
export default function MobileAccessoryBtn(){


    return (
        <div className="flex items-center justify-between space-x-4 p-4">
            <Button icon="pi pi-arrow-left"  className="p-button-text" />
            <Button icon="pi pi-refresh" className="p-button-text" />
            <Button icon="pi pi-arrow-right" className="p-button-text" />
        </div>
    );
}