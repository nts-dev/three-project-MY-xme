import * as THREE from '../../../build/three.module.js';

class HUD {
    constructor(sessionID,scene,progressBarDiv,grid,cameraControls,camera,branch_name,project) {
        this.isMinimized = false;
        this.hudElement = document.createElement("div");
        this.hudElement.id = "hud";
        this.menuButtons = [];
        this.checkBoxList = [];
        this.controlButtons =[]
        this.sessionID= sessionID;
        this.camera = camera;
        this.cameraControls = cameraControls;
        this.scene = scene;
        this.progressBarDiv = progressBarDiv;
        this.grid = grid;
        this.gridData = [];
        this.container ='';
        this.meshGrid = ''


        const ProjectHeader = document.createElement("div");
        ProjectHeader.id = "project-header";
        let controlTable = this.makeButtonsLayout();
        ProjectHeader.appendChild(controlTable);
        let appButton = this.makeButtons()
        ProjectHeader.appendChild(appButton);
        this.hudElement.appendChild(ProjectHeader);

        const hudToggle = document.createElement("div");
        hudToggle.id = "hud-toggle";
        hudToggle.title = "Minimise";

        const hudToggleIcon = document.createElement("img");
        hudToggleIcon.src = 'icons/ic_code_black_24dp.svg'
        hudToggleIcon.id = 'toggle-icon'

        const hudToggleLabel = document.createElement("div");
        hudToggleLabel.id = "hud-toggle-label";


        const mainLayout = document.createElement("div");
        mainLayout.id = 'mainLayout'


        let controlsButton = this.createDisplayTable();

        mainLayout.appendChild(controlsButton);
        this.mainHudElement = document.createElement('div');
        this.mainHudElement.id = 'mainHudElement';
        this.hudElement.appendChild(mainLayout);
        this.mainHudElement.appendChild(this.hudElement)

    }

    makeHud() {

        return [this.mainHudElement,this.controlButtons, this.menuButtons];
    }

    scanQRCode() {

        const url = "http://nts.nl/scanqr/" +this.sessionID;
        parent.window.location.replace(url);
    }

    scanRFCode() {
        const url = "http://nts.nl/scanrf/" +this.sessionID;
        parent.window.location.replace(url);
    }
    makeheaderTable() {

        const hudSearchContainer = document.createElement("div");
        hudSearchContainer.id = "hud-search-container";
        hudSearchContainer.title = "Search here";

        const hudSearch = document.createElement("input");
        hudSearch.type = "text";
        hudSearch.id = "autocomplete";
        hudSearch.placeholder = "Search";
        const searchIcon = document.createElement("div");
        searchIcon.id = "hud-search-icon";

        hudSearchContainer.appendChild(hudSearch);
        hudSearchContainer.appendChild(searchIcon);
        return hudSearchContainer;
    }

    toggle() {
        let displayDiv = document.getElementById('mainLayout');
        let toggleIcon = document.getElementById('toggle-icon');
        let toggleLabel = document.getElementById('hud-toggle-label');
        let toggle = document.getElementById('hud-toggle');

        if(!this.isMinimized){
            toggle.title = 'Maximise'
            displayDiv.style.display = 'none';
            toggleLabel.style.display = 'none';
            this.hudElement.style.background = 'transparent';
            toggleIcon.src = 'icons/ic_menu_black_24dp.svg';
            this.hudElement.style.overflow = 'hidden';

        }
        else if(this.isMinimized){
            toggle.title = 'Minimise'
            displayDiv.style.display = 'block';
            toggleLabel.style.display = 'flex';
            toggleIcon.src = 'icons/ic_code_black_24dp.svg';
            this.hudElement.style.backgroundColor = '#232323';
            this.hudElement.style.overflow = 'auto';

        }

        this.isMinimized = !this.isMinimized;
    }

    makeButtonsLayout() {
        const headerDiv = document.createElement('div');
        headerDiv.id = "hud-mainDiv";

        let buttons = [ 'Animations', 'AudioComponent', 'Info', 'Scenery', 'VR', 'Roof', 'Annotations', 'Palettes'];

        for (const button in buttons) {
            const buttonDiv = document.createElement('div');
            buttonDiv.classList.add('menu-buttons');
            buttonDiv.setAttribute('id',button);
            buttonDiv.setAttribute('clicked', 'false');
            buttonDiv.setAttribute('pressed', 'false');
            buttonDiv.title = buttons[button];
            const iconImg = document.createElement('img');
            iconImg.src = 'icons/'+buttons[button]+'.png';
            iconImg.classList.add('icon');
            buttonDiv.appendChild(iconImg);
            buttonDiv.appendChild(document.createTextNode(buttons[button]));


            this.menuButtons.push(buttonDiv);
            buttonDiv.addEventListener('click', this.onMenuButtonClicked.bind(this));

            headerDiv.appendChild(buttonDiv);

        }
        return  headerDiv;
    }

    makeDisplayLayout() {

        return this.createDisplayTable();
    }

    createDisplayTable() {
        const headerDiv = document.createElement('div');
        headerDiv.id = "hud-mainDiv";
        let buttons = ['Wall', 'Label', 'Grid', 'Shadows', 'Map', 'Env', 'Floors'];

        for (const button in buttons) {

            const buttonDiv = document.createElement('div');
            buttonDiv.classList.add('menu-buttons');
            buttonDiv.setAttribute('id',button);
             buttonDiv.setAttribute('clicked', 'false');
            buttonDiv.title = buttons[button];
            buttonDiv.inputMode = 'false'
            const iconImg = document.createElement('img');

            if(buttons[button]=='Env'||buttons[button]=='Floors'){
                iconImg.src = 'icons/Env.png';
            }else{
                iconImg.src = 'icons/hide.png';
            }
            iconImg.classList.add('icon');
            iconImg.id = buttons[button];
            buttonDiv.appendChild(iconImg);
            buttonDiv.appendChild(document.createTextNode(buttons[button]));


            this.controlButtons.push(buttonDiv);
            buttonDiv.addEventListener('click', this.onControlButtonClicked.bind(this));

            headerDiv.appendChild(buttonDiv);
        }
        const containerDiv = document.createElement('div');
        containerDiv.classList.add('menu-buttons');
// add some text to the left
        const textDiv = document.createElement('div');
        textDiv.innerText = 'View';
        textDiv.style.float = 'left';

// add combo options to the right
        const comboDiv = document.createElement('div');
        var comboSelect = document.createElement('select');
        comboSelect.setAttribute("id", "view-options");
        comboSelect = this.addOptionsToCombo(comboSelect);
        comboDiv.appendChild(comboSelect);
        comboDiv.style.float = 'right';

// append both divs to the container
//         containerDiv.appendChild(textDiv);
        containerDiv.appendChild(comboDiv);

        headerDiv.appendChild(containerDiv);
        return  headerDiv;
    }


    addOptionsToCombo(combo) {
    let options = ['Third Person','First Person'];
        for (let i = 0; i < options.length; i++) {
            var option = document.createElement('option');
            option.value = options[i];
            option.text = options[i];
            combo.appendChild(option);
        }
        return combo;
    }

    makeButtons(){
        const headerDiv = document.createElement('div');
        headerDiv.id = "hud-mainDiv";
        let buttons = [ 'Reload', 'QR', 'RF', ];
        var isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        for (const button in buttons) {
            const buttonDiv = document.createElement('div');
            buttonDiv.classList.add('menu-buttons');

            buttonDiv.id = buttons[button]+'_'+button;
            buttonDiv.title = buttons[button];
            const iconImg = document.createElement('img');
            iconImg.src = 'icons/'+buttons[button]+'.png';
            iconImg.classList.add('icon');
            iconImg.id = buttons[button];
            buttonDiv.appendChild(iconImg);
            buttonDiv.appendChild(document.createTextNode(buttons[button]));
            (!isMobileDevice && (buttons[button]=='RF'||buttons[button]=='QR'))?buttonDiv.style.display='none':buttonDiv.style.display='flex'

            this.controlButtons.push(buttonDiv);
            buttonDiv.addEventListener('click', this.onDefaultButtonClicked.bind(this));
            headerDiv.appendChild(buttonDiv);

        }

        return  headerDiv;
    }

    onMenuButtonClicked(event){

        let button  = event.target;
        if (event.target.outerText.length === 0) {
            button = event.target.parentNode;
        }


        if (event.target.outerText.length === 0) {
            button = event.target.parentNode;
        }

        const clicked = button.getAttribute("clicked") === "true";

        if(clicked){

            button.classList.remove('active');
        }
        else{
            button.classList.add('active');

        }


        button.setAttribute("clicked", !clicked);
    }
    onDefaultButtonClicked(event){

        let button  = event.target;

        if (event.target.outerText.length === 0) {
            button = event.target.parentNode;
        }
        // if(button.innerText === 'Reload'){
        //     location.reload();
        // }

        if(button.innerText === 'QR'){
            this.scanQRCode()
        }
        if(button.innerText === 'RF'){
            this.scanRFCode();
        }
    }

    saveCameraState(camera) {
        const cameraState = {
            position: camera.position.toArray(),
            rotation: camera.rotation.toArray(),
            zoom: camera.zoom
        };

        localStorage.setItem('cameraState', JSON.stringify(cameraState));
    }
    onControlButtonClicked(event){

        let iconImg  = event.target;
        let button  = event.target;
        if (event.target.outerText.length === 0) {
            button = event.target.parentNode;
        }
        else{
            iconImg = document.getElementById(event.target.outerText);
        }

        const clicked = button.getAttribute("clicked") === "true";

        if(clicked){
            button.classList.remove('active');

            if(iconImg.src.endsWith("show.png")){
                iconImg.src = 'icons/hide.png';
            }
            else{
                iconImg.src = 'icons/Env.png';
            }

            if(button.id=='2'){
                this.ToggleGrid(false,this);
            }
        }
        else {

            if(iconImg.src.endsWith("hide.png")){
                iconImg.src = 'icons/show.png';
            }
            else{
                iconImg.src = 'icons/EnvUp.png';
            }


            button.classList.add('active');
            if(button.id=='2'){
                this.ToggleGrid(true,this);

            }
        }
        button.setAttribute("clicked", !clicked);



    }

    ToggleGrid(grid) {
     var self=this;
        if (grid) {
            self.showProgressBar('Adding Grid , Please Wait!');
            if (self.gridData.length > 0) {
                setTimeout(function () {
                    for (let i = 0; i < self.gridData.length; i++) {
                        let object = self.scene.getObjectById(self.gridData[i], true);
                        object.layers.mask = 1
                    }
                    self.hideProgressBar();


                }, 100);
            } else {

                self.grid.position.set(0, 2, 0);
                self.scene.add(self.grid);
                setTimeout(function () {
                    self.addGrid(self.scene).then(
                        function (value) {
                            self.gridData = value;
                            self.gridData.push(self.grid.id);
                            self.hideProgressBar();
                        },
                        function (error) { /* code if some error */
                        }
                    );

                }, 100);
            }

        } else {
            this.showProgressBar('Removing Grid, Please Wait!');
            setTimeout(function () {

                for (let i = 0; i < self.gridData.length; i++) {
                    let object = self.scene.getObjectById(self.gridData[i], true);
                    object.layers.mask = 0;
                }
                self.hideProgressBar();
            }, 100);
        }
    }

    showProgressBar(message) {

            this.progressBarDiv.style.display = 'flex';
            this.progressBarDiv.innerText = message;

    }

    hideProgressBar() {


            this.progressBarDiv.style.display = 'none';

    }


    async addGrid(scene) {
        let map = scene.getObjectByName('walls',true);

        let gridIdList = [];

        let posy = 50;
        this.meshGrid =  new THREE.Object3D();
        var self = this;

        const box = new THREE.Box3();
        box.expandByObject(map);
        const size = box.getSize(new THREE.Vector3());
        let x = size.x/100;
        let y = size.z/100;

        for (let i = 0; i <y; i++) {

            let posx = 50;
            for (let i = 0; i < x; i++) {
                let cordinateLabel = this.makeCordinateLabel(posx - 50, posy - 50);
                cordinateLabel.position.set(posx, 0, posy);

                self.meshGrid.add(cordinateLabel);
                gridIdList.push(cordinateLabel.id);
                posx += 100;

            }
            posy += 100;

        }
        this.scene.add(this.meshGrid);
        return gridIdList;
    }


    makeCordinateLabel(x_value, y_value) {
        return this.makePlane(x_value,y_value);

    }

    makePlane(x_value,y_value) {
        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d');
        context.font = `bold 67px Arial`;
        context.fillStyle = "rgb(248,244,244)";
        let cordinates ='('+ x_value +',' + y_value +')' ;
        context.fillText(cordinates, 0, 100);

        var texture = new THREE.Texture(canvas)
        texture.needsUpdate = true;
        var material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
            depthTest: true

        });
        material.transparent = true;

        const geometry = new THREE.PlaneGeometry(100 , 100);
        const plane = new THREE.Mesh(geometry, material);
        plane.rotation.x=THREE.MathUtils.degToRad(-90);
        return plane;
    }
}






export {HUD};
