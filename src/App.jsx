import React, { useEffect } from 'react';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import 'primeicons/primeicons.css';
import './App.css';


import Main from "./Main";
import LazyLoader from "./components/popup/miscellaneous/LazyLoader";

function App() {
    return (

           <>
               <LazyLoader/>
               <Main />
       

           </>


    );
}

export default App;
