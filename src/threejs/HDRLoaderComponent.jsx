import  {useEffect, useState} from 'react';
import { useThree } from '@react-three/fiber';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';
import { EquirectangularReflectionMapping } from 'three';

const HDRLoaderComponent = () => {
    const { _, scene } = useThree();

    const [hdrPath] = useState(`${import.meta.env.VITE_FILE_URL}/HDR_multi_nebulae.hdr`)
    useEffect(() => {
        const rgbeLoader = new RGBELoader();
        rgbeLoader.load(
            hdrPath,
            (texture) => {
                texture.mapping = EquirectangularReflectionMapping;

                // Apply HDR as background
                scene.background = texture;

                // Apply HDR as environment map
                scene.environment = texture;

                console.log('HDR loaded successfully');
            },
            undefined,
            (error) => {
                console.error('Error loading HDR:', error);
            }
        );

        // Cleanup on unmount
        return () => {
            if (scene.background) scene.background.dispose();
            if (scene.environment) scene.environment.dispose();
        };
    }, [hdrPath, scene]);

    return null; // This component doesn't render visible elements
};

export default HDRLoaderComponent;