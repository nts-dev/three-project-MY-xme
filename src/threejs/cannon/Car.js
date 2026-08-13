import * as THREE from 'three';
import * as CANNON from 'cannon-es';

import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader';
import {DRACOLoader} from 'three/examples/jsm/loaders/DRACOLoader.js';
import {Vector3} from "three";

export default class Car {
    constructor(scene, world, camera,orbitControls) {
        this.scene = scene;
        this.world = world;
        this.maxSteerVal = 0.5;
        this.maxForce = 450;
        this.brakeForce = 36;
        this.slowDownCar = 22;
        this.keysPressed = [];

        this.car = {};
        this.chassis = {};
        this.wheels = [];
        this.orbitControls = orbitControls.current
        this.camera = camera
        this.chassisDimension = {
            x: 1.96,
            y: 1,
            z: 4.3
        };
        this.chassisModelPos = {
            x: 0,
            y: -0.629999999999999,
            z: 0
        };
        this.mass = 250;
    }

    init() {

        this.loadModels();
        // this.setChassis();

        this.update()


    }
    initializeCamera() {
        if (this.camera && this.orbitControls) {
            // Set the initial camera position slightly behind the car
            const followDistance = 5; // Distance behind the car
            const followHeight = 2;   // Height above the car

            // Calculate the initial camera position
            const cameraOffset = new THREE.Vector3(0, followHeight, -followDistance);
            this.camera.position.copy(this.car.chassisBody.position).add(cameraOffset);

            // Set the OrbitControls target to the car's position
            this.orbitControls.target.copy(this.car.chassisBody.position);

            // Update OrbitControls to apply the changes
            this.orbitControls.update();
        }
    }

    loadModels() {
        const gltfLoader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();

        dracoLoader.setDecoderConfig({ type: 'js' })
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');

        gltfLoader.setDRACOLoader(dracoLoader);

        gltfLoader.load(`${import.meta.env.VITE_FILE_URL}/chassis.gltf`, gltf => {
            this.chassis = gltf.scene;
            // this.chassis.scale.set(0.1, 0.1, 0.1);
            this.chassis.traverse( function(object){
                if(object.isMesh)
                {
                    object.castShadow = true
                    object.material = new THREE.MeshPhongMaterial({color: '#f831a9'})
                }
            })


            this.scene.add(this.chassis);

            this.setChassis();
            this.initializeCamera()
        })

        this.wheels = [];
        for(let i = 0 ; i < 4 ; i++) {
            gltfLoader.load(`${import.meta.env.VITE_FILE_URL}/wheel.gltf`, gltf => {
                this.wheels[i] = gltf.scene;
                // this.wheels[i].scale.set(0.1, 0.1, 0.1); // Scale the wheels

                if (i === 1 || i === 3) {
                    this.wheels[i].scale.x *= -1; // Flip the wheels on one side
                    this.wheels[i].scale.z *= -1;
                }
                this.scene.add(this.wheels[i]);
            })
        }
    }

    setChassis() {
        const chassisShape = new CANNON.Box(new CANNON.Vec3(this.chassisDimension.x * 0.5, this.chassisDimension.y * 0.5, this.chassisDimension.z * 0.5));
        const chassisBody = new CANNON.Body({mass: this.mass, material: new CANNON.Material({friction: 0})});
        chassisBody.addShape(chassisShape);

        this.car = new CANNON.RaycastVehicle({
            chassisBody,
            indexRightAxis: 0,
            indexUpAxis: 1,
            indexForwardAxis: 2
        });
        this.car.addToWorld(this.world);
        this.setWheels();

        this.controls();
    }

    setWheels() {
        this.car.wheelInfos = [];
        this.car.addWheel({
            radius: 0.35,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 55,
            suspensionRestLength: 0.5,
            frictionSlip: 30,
            dampingRelaxation: 2.3,
            dampingCompression: 4.3,
            maxSuspensionForce: 10000,
            rollInfluence:  0.01,
            axleLocal: new CANNON.Vec3(-1, 0, 0),
            chassisConnectionPointLocal: new CANNON.Vec3(0.75, 0.1, -1.32),
            maxSuspensionTravel: 1,
            customSlidingRotationalSpeed: 30,
        });
        this.car.addWheel({
            radius: 0.35,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 55,
            suspensionRestLength: 0.5,
            frictionSlip: 30,
            dampingRelaxation: 2.3,
            dampingCompression: 4.3,
            maxSuspensionForce: 10000,
            rollInfluence:  0.01,
            axleLocal: new CANNON.Vec3(-1, 0, 0),
            chassisConnectionPointLocal: new CANNON.Vec3(-0.78, 0.1, -1.32),
            maxSuspensionTravel: 1,
            customSlidingRotationalSpeed: 30,
        });
        this.car.addWheel({
            radius: 0.35,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 55,
            suspensionRestLength: 0.5,
            frictionSlip: 30,
            dampingRelaxation: 2.3,
            dampingCompression: 4.3,
            maxSuspensionForce: 10000,
            rollInfluence:  0.01,
            axleLocal: new CANNON.Vec3(-1, 0, 0),
            chassisConnectionPointLocal: new CANNON.Vec3(0.75, 0.1, 1.25),
            maxSuspensionTravel: 1,
            customSlidingRotationalSpeed: 30,
        });
        this.car.addWheel({
            radius: 0.35,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 55,
            suspensionRestLength: 0.5,
            frictionSlip: 30,
            dampingRelaxation: 2.3,
            dampingCompression: 4.3,
            maxSuspensionForce: 10000,
            rollInfluence:  0.01,
            axleLocal: new CANNON.Vec3(-1, 0, 0),
            chassisConnectionPointLocal: new CANNON.Vec3(-0.78, 0.1, 1.25),
            maxSuspensionTravel: 1,
            customSlidingRotationalSpeed: 30,
        });

        this.car.wheelInfos.forEach( function(wheel, index) {
            const cylinderShape = new CANNON.Cylinder(wheel.radius, wheel.radius, wheel.radius / 2, 20)
            const wheelBody = new CANNON.Body({
                mass: 1,
                material: new CANNON.Material({friction: 0}),
            })
            const quaternion = new CANNON.Quaternion().setFromEuler(-Math.PI / 2, 0, 0)
            wheelBody.addShape(cylinderShape, new CANNON.Vec3(), quaternion)
            // this.wheels[index].wheelBody = wheelBody;
        }.bind(this));
    }


    resetCar = () => {
        this.car.chassisBody.position.set(0, 4, 0);
        this.car.chassisBody.quaternion.set(0, 0, 0, 1);
        this.car.chassisBody.angularVelocity.set(0, 0, 0);
        this.car.chassisBody.velocity.set(0, 0, 0);
    }

    brake = () => {
        this.car.setBrake(this.brakeForce, 0);
        this.car.setBrake(this.brakeForce, 1);
        this.car.setBrake(this.brakeForce, 2);
        this.car.setBrake(this.brakeForce, 3);
    }

     stopCar = () => {
        this.car.setBrake(this.slowDownCar, 0);
        this.car.setBrake(this.slowDownCar, 1);
        this.car.setBrake(this.slowDownCar, 2);
        this.car.setBrake(this.slowDownCar, 3);

    }

     stopSteer = () => {
        this.car.setSteeringValue(0, 2);
        this.car.setSteeringValue(0, 3);
        // this.isMoving = false
    }

    hindMovement = () => {
        if(this.car==null){
            return
        }
        if(this.keysPressed.includes("r") || this.keysPressed.includes("r")) this.resetCar();


        if(!this.keysPressed.includes(" ") && !this.keysPressed.includes(" ")){
            this.car.setBrake(0, 0);
            this.car.setBrake(0, 1);
            this.car.setBrake(0, 2);
            this.car.setBrake(0, 3);

            if(this.keysPressed.includes("a") || this.keysPressed.includes("arrowleft")) {
                this.car.setSteeringValue(this.maxSteerVal, 2);
                this.car.setSteeringValue(this.maxSteerVal, 3);

            }
            else if(this.keysPressed.includes("d") || this.keysPressed.includes("arrowright")) {
                this.car.setSteeringValue(this.maxSteerVal * -1, 2);
                this.car.setSteeringValue(this.maxSteerVal * -1, 3);

            }
            else this.stopSteer();

            if(this.keysPressed.includes("w") || this.keysPressed.includes("arrowup")) {
                this.car.applyEngineForce(this.maxForce * -1, 0);
                this.car.applyEngineForce(this.maxForce * -1, 1);
                this.car.applyEngineForce(this.maxForce * -1, 2);
                this.car.applyEngineForce(this.maxForce * -1, 3);

            }
            else if(this.keysPressed.includes("s") || this.keysPressed.includes("arrowdown")) {
                this.car.applyEngineForce(this.maxForce, 0);
                this.car.applyEngineForce(this.maxForce, 1);
                this.car.applyEngineForce(this.maxForce, 2);
                this.car.applyEngineForce(this.maxForce, 3);

            }
            else this.stopCar();
        }
        else
            this.brake();
    }

onKeyDown(e)  {
    if(!this.keysPressed.includes(e.key.toLowerCase())) this.keysPressed.push(e.key.toLowerCase());
    this.hindMovement();
}
onKeyUp(e) {
    // e.preventDefault();
    this.keysPressed.splice(this.keysPressed.indexOf(e.key.toLowerCase()), 1);
    this.hindMovement();
}


    controls() {
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('keyup', this.onKeyUp.bind(this));

    }
    updateWorld = () => {
        if (this.car && this.car.wheelInfos && this.chassis.position && this.wheels[0]?.position) {
            this.chassis.position.set(
                this.car.chassisBody.position.x + this.chassisModelPos.x,
                this.car.chassisBody.position.y + this.chassisModelPos.y,
                this.car.chassisBody.position.z + this.chassisModelPos.z
            );

            this.chassis.quaternion.copy(this.car.chassisBody.quaternion);
            const localOffset = new THREE.Vector3(0, 5, -10);
            const worldOffset = localOffset.clone().applyQuaternion(this.car.chassisBody.quaternion);
            const desiredPlace = new THREE.Vector3().copy(this.car.chassisBody.position).add(worldOffset);

// Smoothly move the camera
            this.camera.position.lerp(desiredPlace, 0.1);

// Smooth OrbitControls target too
            this.orbitControls.target.lerp(this.car.chassisBody.position, 0.1);


            for (let i = 0; i < 4; i++) {
                if (this.car.wheelInfos[i]) {
                    this.car.updateWheelTransform(i);
                    this.wheels[i].position.copy(this.car.wheelInfos[i].worldTransform.position);
                    this.wheels[i].quaternion.copy(this.car.wheelInfos[i].worldTransform.quaternion);
                }
            }

        }
    };

    update() {

        this.world.addEventListener('postStep', this.updateWorld);
    }

    destroy() {
        if (this.isDestroyed) return; // Prevent multiple calls
        this.isDestroyed = true;

        // 🚀 Remove chassis from scene and physics world
        if (this.chassis) {
            this.scene.remove(this.chassis);
            this.chassis = null;
        }
        if (this.car.chassisBody) {
            this.world.removeBody(this.car.chassisBody);
        }

        // 🚀 Remove wheels
        this.wheels.forEach((wheel, i) => {
            this.scene.remove(wheel);
            this.world.removeBody(this.car.wheelInfos[i]?.worldTransform);
        });
        this.wheels = [];
        // 🚀 Remove vehicle from physics world
        if (this.car) {
            this.world.removeBody(this.car.chassisBody);
            this.car = null;
        }
        // 🚀 Unsubscribe event listeners
        this.world.removeEventListener('postStep', this.updateWorld.bind(this));
        window.removeEventListener('keydown', this.onKeyDown.bind(this));
        window.removeEventListener('keyup', this.onKeyUp.bind(this));
    }


}
