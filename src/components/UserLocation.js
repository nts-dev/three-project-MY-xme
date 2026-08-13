// import the required react libraries
import React, {useState} from 'react';
import {Dialog} from "primereact/dialog";
import {Geolocation} from '@capacitor/geolocation';

export default function LocationPopup() {

    const [visible, setVisible] = useState(true);

    return (
        <div>
            <Dialog
                header="Location Details"
                visible={visible} position='top-right'
                draggable={false}
                resizable={false}
                onHide={() => setVisible(false)}
                className="popup">
                <UserLocation/>
            </Dialog>
        </div>
    )
};

function UserLocation() {
    // const variable array to save the users location
    const [userLocation, setUserLocation] = useState(null);

    // define the function that finds the users geolocation
    const getUserLocation = () => {
        // if geolocation is supported by the users browser
        if (navigator.geolocation) {
            // get the current users location
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    // save the geolocation coordinates in two variables
                    const {latitude, longitude} = position.coords;
                    // update the value of userlocation variable
                    setUserLocation({latitude, longitude});
                },
                // if there was an error getting the users location
                (error) => {
                    console.error('Error getting user location:', error);
                }
            );
        }
        // if geolocation is not supported by the users browser
        else {
            console.error('Geolocation is not supported by this browser.');
        }
    };

    const printCurrentPosition = async () => {
        const coordinates = await Geolocation.getCurrentPosition();

        const {latitude, longitude} = coordinates.coords;
        // update the value of userlocation variable
        setUserLocation({latitude, longitude});

        console.log('Current position:', coordinates);
    };
    //
    // if (Capacitor.getPlatform() == 'android') {

    Geolocation.watchPosition({timeout: 5000}, (position, err) => {
        console.log(position)

        if (position) {
            const {latitude, longitude} = position.coords;
            // update the value of userlocation variable
            setUserLocation({latitude, longitude});
        } else if (err) {
            console.error('Error watching position: ', err);
        }
    });
    // }

    // return an HTML page for the user to check their location
    return (
        <div>
            <h1>Geolocation App</h1>
            <h1>Watch Position</h1>
            {/* if the user location variable has a value, print the users location */}
            {userLocation && (
                <div>
                    <h2>User Location</h2>
                    <p>Latitude: {userLocation.latitude}</p>
                    <p>Longitude: {userLocation.longitude}</p>
                </div>
            )}
        </div>
    );
}


