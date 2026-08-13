import * as THREE from 'three'
import {AddLabel} from "../label/Label"
import useGame from "../../hooks/useGame";
import {Vector3} from "three";

const colliders: any[] = []

export default function Rack(scene: any, objectAttributes: any, pallete: any, l: number, w: number,projectId: number) {

    const material = (image: string)=>{
        const textureLoader = new THREE.TextureLoader();
        const texture = textureLoader.load(image)
        texture.colorSpace = THREE.SRGBColorSpace;
       return  new THREE.MeshLambertMaterial({
            map: texture,
        });
    }



    const horizontalBeam = () => {
        const {fields} = objectAttributes
        const {Depth, Width,AssetID3} = fields

        const hGroup = new THREE.Group()

        if(!Depth || !Width || !AssetID3){
            return hGroup
        }

        if (AssetID3.value == 82) {
            const hBeam = makeRegularAsset(parseFloat(Width.value) / 10, 4, 3, material(`${import.meta.env.VITE_FILE_URL}/Grey 10.jpg`));
            hBeam.position.x = -parseFloat(Width.value) / 20
            const hBeamClone = hBeam.clone()
            hBeamClone.position.z = parseFloat(Depth.value) / 10
            hGroup.add(hBeam)
            hGroup.add(hBeamClone)
        }
        else{

            const offset = 5
        const fPallete = makeRegularAsset(parseFloat(Depth.value) / 10 +offset, 4, parseFloat(Width.value)/10, material(`${import.meta.env.VITE_FILE_URL}/Grey 10.jpg`));// makeRegularAsset(parseFloat(Width.value)/10 , 1, parseFloat(Depth.value)/10,  material(`${process.env.REACT_APP_FILE_URL}/T_BrushedMetal_06_BC.jpg`));
        fPallete.position.z = parseFloat(Depth.value) / 20
        fPallete.position.x =  -parseFloat(Width.value) / 20
        fPallete.rotation.y =  Math.PI/2
        hGroup.add(fPallete)
        hGroup.position.z = -parseFloat(Depth.value) / 20
    }
        return hGroup

    }
    const verticalBeam = () => {
        const {fields} = objectAttributes
        const {Height, Depth, Width} = fields

        const vGroup = new THREE.Group()

        if(!Height || !Depth){
            return vGroup
        }
        const image = projectId==32?'grey.png': 'Blue.jpg'
        const vBeam = makeRegularAsset(4, parseFloat(Height.value) / 10, 4,  material(`${import.meta.env.VITE_FILE_URL}/${image}`));
        // const cBeam = makeRegularAsset(4, 4, parseFloat(Depth.value) / 10,  material(`${process.env.REACT_APP_FILE_URL}/${image}`));
        const vBeamClone = vBeam.clone()
        vBeamClone.position.z = parseFloat(Depth.value) / 10
        // cBeam.position.z = parseFloat(Depth.value) / 20
        // cBeam.position.y = -parseFloat(Height.value) /30
        vGroup.add(vBeam)
        vGroup.add(vBeamClone)
        // vGroup.add(cBeam)
        vGroup.position.z = -parseFloat(Depth.value) / 20
        return vGroup

    }
    const addRackPositions = (Position: number, hBeam: any, Width: number, AssetID3: number, Depth: number, fPallete: any, index: number) => {

        if (AssetID3 == 82) {
            let offset = 0
            for (let i = 0; i < Position; i++) {

                const pClone = pallete.clone()
                pClone.name = 'scaffolding'
                const pLable = AddLabel(projectId,20, 4, [`W/${index}-front-${i + 1}`], new THREE.Vector3(((Depth / 20) + 8.1), -2, 0), 30, 'label',new Vector3(),[] ,false, false)


                if (pLable) {
                    pLable.rotation.y = Math.PI / 2
                    pLable.position.y = -2
                }
                pClone.add(pLable)
                pClone.position.x = (w - (Width / 10)) + offset
                pClone.position.z = l
                pClone.position.y = 2
                pClone.rotation.y = -Math.PI / 2
                hBeam.add(pClone)
                offset += l * 2
            }
            hBeam.position.z = -Depth / 20
        } else {

            // let offset = 0
            //const width = (Width / 10) / Position
            // console.log(width)
            // for (let i = 0; i < Position; i++) {
            //     const pClone = fPallete.clone();
            //
            //     pClone.name = 'scaffolding'
               // if(projectId==132){
               //  const boxRight = boxObj.clone()
               //  boxRight.rotation.y = THREE.MathUtils.degToRad(90)
               //  boxRight.position.z = bL
               //  const boxLeft = boxObj.clone()
               //  boxLeft.rotation.y = THREE.MathUtils.degToRad(90)
               //  boxLeft.position.z = -bL
               //  pClone.add(boxRight)
               //  pClone.add(boxLeft)
               // }
               //  if(projectId!=132) {
               //      const pLable = AddLabel(20, 4, [`W/${index}-front-${i + 1}`], new THREE.Vector3(0, -2, (Depth / 20) + 1), 50, 'label')
               //      pClone.add(pLable)
               //  }

            //     pClone.position.x = (width - (Width / 10) - width / 2) + offset
            //     pClone.position.z = Depth / 20
            //     pClone.position.y = 2
            //     // hBeam.add(pClone)
            //     offset += width
            // }
        }

        return hBeam;
    }


    const addHorizontalBeams = (Distance: string, hBeams: any, rGroup: any, Width: number, Position: number, AssetID3: number, Depth: number) => {
        const distances = Distance.split("\n");
        const width = (Width / 10) / Position
        const fPallete = makeRegularAsset(width, 1, Depth / 10,  material(`${import.meta.env.VITE_FILE_URL}/T_BrushedMetal_06_BC.jpg`));
        distances.map((distance, index) => {
            const hBeam = hBeams.clone()
            const hBeamWithPallete = addRackPositions(Position, hBeam, Width, AssetID3, Depth, fPallete, index);
            hBeamWithPallete.position.y = parseFloat(distance)
            rGroup.add(hBeamWithPallete)
        })
    }

    const rack = () => {

        const {fields} = objectAttributes
        const {Width, Height, Distance, Positions, AssetID3, Depth} = fields

        const rGroup = new THREE.Group()
        if(!Width || !Height || !Distance || !Positions || !AssetID3 || !Depth){
            return rGroup
        }

        const vBeams = verticalBeam()
        const hBeams = horizontalBeam()
        addHorizontalBeams(Distance.value, hBeams, rGroup, Width.value, Positions.value, AssetID3.value, Depth.value)

        vBeams.position.y = parseFloat(Height.value) / 20
        const vBeamClone = vBeams.clone()
        vBeamClone.position.x = -parseFloat(Width.value) / 10
        rGroup.add(vBeams)
        rGroup.add(vBeamClone)

        const x = fields['X-pos']?.value ? fields['X-pos']?.value : 0
        const y = fields['Y-pos']?.value ? fields['Y-pos']?.value : 0
        const z = fields['Z-pos']?.value ? fields['Z-pos']?.value : 0

        const angle = fields['Angle']?.value ? fields['Angle']?.value : 0
        rGroup.position.x = parseFloat(x) / 100
        rGroup.position.y = parseFloat(z) / 100
        rGroup.position.z = parseFloat(y) / 100
        rGroup.rotation.y = THREE.MathUtils.degToRad(angle)
        rGroup.scale.multiplyScalar(0.01)
        return rGroup
    }

    const makeRegularAsset = (x: number, y: number, z: number, material: any) => {

        const geometry = new THREE.BoxGeometry(x, y, z);

        const asset: any = new THREE.Mesh(geometry, material);
        asset.name = 'scaffolding'
        return asset;

    }
    const rackObj = rack()

    scene.add(rackObj)

    return colliders;

}
