import React, {useEffect} from "react";
import {createRoot} from "react-dom/client";
import FilesContent from "./FilesContent";
import useGame from "../../../../hooks/useGame";

export default function Files({id, filesTab}) {
    const setFiles = useGame((state) => state.setFiles);
    const getFiles = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/getDocumentFiles/${id}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            const fileList = []
            for(const fileData of data){
                const newFileObject = {
                    url: `${import.meta.env.VITE_FILE_URL}/${fileData.name}`,
                    capturedImage: fileData.name,
                    type: fileData.type?.split('/')[1],
                    date: fileData.date,
                    id:fileData.id,
                    name: fileData.name

                };
                fileList.push(newFileObject)
            }
            setFiles(fileList)
            // Create and append the table container
            const filesContainer = document.createElement('div');
            filesContainer.style.padding = "0 10px 10px 10px";
            createRoot(filesContainer).render(<FilesContent key='file-contents'/>);
            filesTab.element.appendChild(filesContainer);

        } catch (error) {
            console.error('Failed to fetch documents:', error);
        }
    };

    useEffect(() => {
        getFiles();

    }, [id,filesTab])

    return null
}