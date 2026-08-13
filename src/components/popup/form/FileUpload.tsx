import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import { AttachFile } from "@mui/icons-material";
import React from "react";
import { styled } from "@mui/material/styles";
import useGame from "../../../hooks/useGame";

export default function FileUpload({type, nameType}: any) {
    const setImagesToSave = useGame((state: any) => state.setImagesToSave);
    const imagesToSave = useGame((state: any) => state.imagesToSave);
    const setImages = useGame((state: any) => state.setImages);
    const images: any = useGame((state: any) => state.images)


    const setFilesToSave = useGame((state: any) => state.setFilesToSave);
    const filesToSave = useGame((state: any) => state.filesToSave);
    const setFiles = useGame((state: any) => state.setFiles);
    const files: any = useGame((state: any) => state.files)

    const VisuallyHiddenInput = styled('input')({
        clip: 'rect(0 0 0 0)',
        clipPath: 'inset(50%)',
        height: 1,
        overflow: 'hidden',
        position: 'absolute',
        bottom: 0,
        left: 0,
        whiteSpace: 'nowrap',
        width: 1,
    });

    const handleFileChange = (event: any) => {
        const filesData = event.target.files;

        if (filesData.length) {
            const file = filesData[0];
            const blob = new Blob([file], { type: file.type });
            const fileName = file.name;
            const getFileExtension = (mimeType: any) => {
                const mimeToExt: Record<string, string> = {
                    'image/jpeg': 'jpg',
                    'image/png': 'png',
                    'image/gif': 'gif',
                    'image/webp': 'webp',
                    'video/mp4': 'mp4',
                    'video/webm': 'webm',
                    'video/ogg': 'ogv',
                    'application/pdf': 'pdf'
                };
                return mimeToExt[mimeType]; // Default to 'png' if MIME type is not recognized
            };

            const fileExtension = getFileExtension(file.type);

            const previewUrl = URL.createObjectURL(blob);
            const imageName = Math.random().toString(36).replace(/[^a-z]+/g, '').substring(0, 5);

            if(type=='image'){
                const newImageObject = {
                    itemImageSrc: previewUrl,
                    thumbnailImageSrc: previewUrl,
                    alt: 'Captured Image',
                    title: 'Captured Photo',
                    capturedImage: `${imageName}.${fileExtension}`,
                    type: file.type.startsWith('image/') ? 'image' : 'video',
                    blob,
                };

                setImages([newImageObject, ...images]);
                setImagesToSave([newImageObject, ...imagesToSave]);
            }
            else{
                const newFileObject = {
                    name: fileName,
                    date: new Date().toISOString(),
                    url: previewUrl,
                    capturedImage:fileName,
                    type: 'pdf',
                    blob,
                };


                  setFiles([newFileObject, ...files]);
                setFilesToSave([newFileObject, ...filesToSave]);
            }
        }
    };

    return (
        <Tooltip title={`Upload ${nameType}`}>
            <IconButton aria-label="Attach File" component="label">
                <AttachFile fontSize="small" />
                <VisuallyHiddenInput
                    type="file"
                    accept= {type=="image"? "image/jpeg, image/png, video/mp4, video/webm": "application/pdf"} // Define allowed file types here
                    onChange={handleFileChange}
                    multiple
                />
            </IconButton>
        </Tooltip>
    );
}
