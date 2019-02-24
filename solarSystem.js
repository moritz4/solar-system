"use strict";

// Declare global variables
var camera, scene, renderer, planets, light, controls;
const TIMESTEP = 1e22;

// Initialise the scene, and draw it for the first time.
loadPlanetData();

// Add keyboard listener for keypresses
//document.addEventListener('keydown', handleKeyDown);

function loadPlanetData()
{    
    Papa.parse("planetsData.csv", {download: true, header: true, skipEmptyLines: true, dynamicTyping: true, complete: function(results) 
            {
                createPlanetsObject(results.data); 
                init();           
                animate();
            }
        }
    );   
}

// Creates an array of objects which store planet state and planet mesh
function createPlanetsObject(planetData)
{
    planets = planetData;
    
    
    var loader = new THREE.TextureLoader();
    loader.setPath('textures/');
    
    // Loop through each planet, creating states from the given information and creating a mesh
    for(var i = 0; i < planets.length; i++)
    {
        // Construct vectors from the position and velocity information
        var position = new THREE.Vector3(planets[i].positionX, planets[i].positionY, planets[i].positionZ);
        var velocity = new THREE.Vector3(planets[i].velocityX, planets[i].velocityY, planets[i].velocityZ);

        // Construct empty force and acceleration vectors for use later
        var force = new THREE.Vector3(0, 0, 0);
        var acceleration = new THREE.Vector3(0, 0, 0);

        // Add these to the object
        planets[i].position = position;
        planets[i].velocity = velocity;
        planets[i].force = force;
        planets[i].acceleration = acceleration;

        // Create mesh from given radius, position, and colour and add to object and scene
        var geometry = new THREE.SphereGeometry(planets[i].radius, 21, 21);
        
        if(planets[i].name == "Sun")
        {
            var material = new THREE.MeshStandardMaterial({emissiveMap: loader.load(planets[i].name + ".jpg"), emissive: 0xffffff});
        }
        else
        {
            var material = new THREE.MeshLambertMaterial({map: loader.load(planets[i].name + ".jpg")});
        }
            
        
        var sphere = new THREE.Mesh(geometry, material);

        // Enable shadow casting for non-Sun planets
        if(planets[i].name != "Sun")
        {
            sphere.castShadow = true;
            sphere.receiveShadow = true;
        }

        // Create rings for Saturn
        if(planets[i].name == "Saturn")
        {
            geometry = new THREE.RingGeometry(planets[i].radius * 1.2, planets[i].radius * 2.5, 20);
            material = new THREE.MeshLambertMaterial( {map: loader.load("rings.jpg"), side: THREE.DoubleSide } );
            
            var rings = new THREE.Mesh(geometry, material);
            rings.rotateX(1.5);
            rings.rotateY(0.05);
            
            // create group from the sphere and the rings
            var group = new THREE.Group();
            group.add(sphere);
            group.add(rings);

            sphere = group;
        }

        var positionInAU = planets[i].position.clone();
        positionInAU.multiplyScalar(m2AU(1));

        sphere.position.copy(positionInAU);
        planets[i].mesh = sphere;   

        // Dispose of unneeded objects
        delete planets[i].colour;
        delete planets[i].positionX;
        delete planets[i].positionY;
        delete planets[i].positionZ;
        delete planets[i].velocityX;
        delete planets[i].velocityY;
        delete planets[i].velocityZ;
    }
}

// Scene initialisation. This function is only run once, at the very beginning.
function init()
{
    scene = new THREE.Scene({colour: 0x909090});

    // Create a skybox
    var geometry = new THREE.SphereGeometry(1000, 10, 10);
    var loader = new THREE.TextureLoader();
    loader.setPath('textures/skybox/');
    var material = new THREE.MeshBasicMaterial({map: loader.load("milkyway.jpg"), side: THREE.DoubleSide});
    var skybox = new THREE.Mesh(geometry, material);
    scene.add(skybox);
    
    // Set up the camera, move it to (3, 4, 5) and look at the origin (0, 0, 0).
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 10000);
    camera.position.set(6, 8, 10);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    // Basic ambient lighting.
    scene.add(new THREE.AmbientLight(0xffffff, 0.2));

    // Add pointlights
    light = new THREE.PointLight(0xffffff, 2);
    light.castShadow = true;
    light.position.copy(planets[0].mesh.position)
    scene.add(light);

    // Set up the Web GL renderer.
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio); // HiDPI/retina rendering
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap
    document.body.appendChild(renderer.domElement);

    // Handle resizing of the browser window.
    window.addEventListener('resize', handleResize, false);
    
    // Add controls
    controls = new THREE.OrbitControls(camera);

    // Draw all planets
    for(var i = 0; i < planets.length; i++)
    {
        scene.add(planets[i].mesh);
    }
}

// Animation loop function. This function is called whenever an update is required.
function animate()
{
    requestAnimationFrame(animate);

    calculateForces();
    calculateNewPositions();
    movePlanets();

    //Move light to always be in the sun
    light.position.copy(planets[0].mesh.position);

    controls.update();

    // Render the current scene to the screen.
    renderer.render(scene, camera);
}

function calculateNewPositions()
{
    // Loop through each planet
    for(var i = 0; i < planets.length; i++)
    {
        // First caluculate acceleration of planet
        planets[i].acceleration = planets[i].force.clone();
        planets[i].acceleration.divideScalar(planets[i].mass);

        // Next calculate velocity based on current velocity and acceleration
        var summand1 = planets[i].acceleration;
        summand1.multiplyScalar(TIMESTEP);
        planets[i].velocity.add(summand1);

        // Next calculate displacement
        var summand2 = planets[i].velocity.clone();
        summand2.multiplyScalar(TIMESTEP);
        
        var summand3 = planets[i].acceleration.clone();
        summand3.multiplyScalar(0.5 * Math.pow(TIMESTEP, 2));
       
        var summand1 = planets[i].position.clone();
        summand1.multiplyScalar(AU2m(1));
        summand1.add(summand2);
        //summand1.add(summand3);
        summand1.multiplyScalar(m2AU(1));
        planets[i].position.copy(summand1);


    }
}

// Functionw hich claulcated total force on each planet
function calculateForces()
{
    // Loop through each planet
    for(var i = 0; i < planets.length; i++)
    {
        var force = new THREE.Vector3(0, 0, 0);
        // Loop through every other planet
        for(var j = 0; j < planets.length; j++)
        {
            if(i != j)
            {
                force.add(gravitationalForce(planets[i], planets[j]));
                planets[i].force = force;
            }
        }
    }


}

// Calucaltes gravitational force between two bodies
function gravitationalForce(planet1, planet2)
{
    var magnitude = (6.67408e-11 * planet1.mass * planet2.mass) / Math.pow(AU2m(planet1.position.distanceTo(planet2.position)), 2);

    var direction = planet2.position.clone();
    direction.sub(planet1.position);
    direction.normalize();
    
    direction.multiplyScalar(magnitude);

    return(direction);

}

// Converts meters to astronomial unit
function m2AU (meters)
{
    return(meters / 149597870700);
}

// Converts astronomial unit to meters
function AU2m (AU)
{
    return(AU * 149597870700);
}

// Moves the planet meshes given their updated positions
function movePlanets()
{
    // Loop through each planet, changing the position of the mesh
    for(var i = 0; i < planets.length; i++)
    {
        var positionInAU = planets[i].position.clone();
        positionInAU.multiplyScalar(m2AU(1));
        
        planets[i].mesh.position.copy(positionInAU);

        // Rotate planets, each by same amount
        if(planets[i].name != "Sun")
        {
            planets[i].mesh.rotateY(0.01);
        }
    }
}

// Handle resizing of the browser window.
function handleResize()
{
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}