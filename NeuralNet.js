const INPUT = 0;
const OUTPUT = 1;
const HIDDEN = 2;

class NeuralNetwork {
    constructor(inpSize, outSize, innovs, connectionGenes) {
        this.innovations = innovs; //A reference to the global innovation number

        this.fitness = 0;
        // this.adjustedFitness = 0;
        // this.prob = 0;

        this.inpSize = inpSize;
        this.outSize = outSize;

        this.nodes = []; //An array of nodes, with the index being the id

        this.connections = {}; //A dictionary of all connections. Key=InnovNum
        if (connectionGenes) { //If a set of connections was passed in, use those
            this.connections = connectionGenes.connections; //Set all of the connections
            this.nodes = connectionGenes.generateNodes(this.inpSize, this.outSize, this.connections); //Set all of the nodes (with correct references)
        } else { //Otherwise, generate new connection from all inps to all outs
            this.genInpOutNodes(); //Generates all of the inp and output nodes
            for (let inp = 0; inp < this.inpSize; inp++) {
                for (let out = this.inpSize; out < this.outSize + this.inpSize; out++) {
                    this.addConnection(inp, out); //Create a new connection from every input to every output
                }
            }
        }
    }

    mutate(probs) {
        //Weight change mutations
        for (const innovNum in this.connections) {
            // if (Math.random() < 0.5) { //An 80% chance of weights being mutated
            if (Math.random() < probs[0]) { //40% Chance of weight being uniformly perturbed
                this.connections[innovNum].val += randChange();
            } else if (Math.random() < probs[1]) { //If not perturbed, a 10% chance of being assigned a new value
                this.connections[innovNum].val = randWeight();
            }
            if (Math.random() < probs[2]) { //A 3% chance to flip an enabled/disable connection
                this.mutateEnableDisable(innovNum);
            }
            // }
        }
        //Topological Mutations
        if (Object.keys(this.connections).length === 0) return;
        if (Math.random() < probs[3]) { //3% chance of splitting connection
            this.splitConnection(); //TODO Should this be in the loop above?
        }
        if (Math.random() < probs[4]) { //2% chance of adding a new connection
            const amtOfNodes = Object.keys(this.nodes).length;
            for (let attempts = 0; attempts < 1000; attempts++) { //Attempt to find a new connection 1000 times
                const from = Math.floor(Math.random() * amtOfNodes); //It can randomly go from any node
                const to = Math.floor(Math.random() * (amtOfNodes - this.inpSize)) + this.inpSize; //It can feed into any node that is not an input
                let good = true;
                for (const inpConnection of this.nodes[to].inps) {
                    if (inpConnection.inp == from) { //Make sure that connection does not already exist
                        good = false;
                        break;
                    }
                }
                if (good) { //If it was not a previously existing connection
                    this.addConnection(from, to); //Then add it
                    break;
                }
            }
        }
    }

    copy() {
        let copyGenes = new Genes();
        for (const innovNum in this.connections) {
            copyGenes.add(innovNum, this.connections[innovNum].copy());
        }
        return new NeuralNetwork(this.inpSize, this.outSize, this.innovations, copyGenes);
    }

    mutateEnableDisable(innovNum) {
        // const innovNums = Object.keys(this.connections);
        // const innovNum = innovNums[Math.floor(Math.random() * innovNums.length)];
        this.connections[innovNum].enabled = !this.connections[innovNum].enabled; //Flip the enabled/disable state of a random connection
    }

    // mutateConnection() { //Randomly changes the value of a connection
    //     const enabledConnectionsPool = []; //An array of the innovation numbers of enabled connections
    //     for (const innovNum in this.connections) {
    //         if (this.connections[innovNum].enabled) enabledConnectionsPool.push(parseInt(innovNum));
    //     }
    //     const connection = this.connections[enabledConnectionsPool[Math.floor(Math.random() * enabledConnectionsPool.length)]]; //Pick a random enabled connection
    //     if (Math.random() < 0.5) {
    //         connection.val = randWeight(); //A 50% chance to pick an entirely new random weight
    //     } else {
    //         connection.val += randWeight(); //A 50% chance to modify the current weight by a random amount
    //     }
    // }

    splitConnection() { //A mutation that splits a connection into 2, with a new node in between
        const enabledConnectionsPool = []; //An array of the innovation numbers of enabled connections
        for (const innovNum in this.connections) {
            if (this.connections[innovNum].enabled) enabledConnectionsPool.push(parseInt(innovNum));
        }
        if (enabledConnectionsPool.length <= 0) return; //Don't try to split a connection if there are none to split!
        let oldConnection = this.connections[enabledConnectionsPool[Math.floor(Math.random() * enabledConnectionsPool.length)]]; //Pick a random enabled connection
        oldConnection.enabled = false; //Disable the old connection
        this.newNode(); //Create a new node
        this.addConnection(oldConnection.inp, this.nodes.length - 1, 1); //The new inp connection has a weight of 1
        this.addConnection(this.nodes.length - 1, oldConnection.out, oldConnection.val); //The new out connection has the same weight as the old one
    }

    addConnection(from, to, weight, enabled) { //Creates a new connection from "from" and to "to", with a random weight btwn -1 and 1, and updates the impacted nodes accordingly
        if (weight === undefined) weight = randWeight(); //A random weight for the new connection btwn -1 and 1
        if (enabled === undefined) enabled = true;

        let innovNum;
        const connectionId = this.genConnectionId(from, to);

        if (connectionId in this.innovations.innovations) {
            innovNum = this.innovations.innovations[connectionId];
        } else {
            this.innovations.innovations[connectionId] = this.innovations.num;
            innovNum = this.innovations.num;
            this.innovations.num++;
        }

        this.connections[innovNum] = new Connection(from, to, weight, enabled); //Add the new connection
        this.nodes[to].inps.push(this.connections[innovNum]); //Update the connection node with the new connection
    }

    genConnectionId(from, to) {
        return from + "-" + to;
    }

    genInpOutNodes() {
        for (let i = 0; i < this.inpSize + this.outSize; i++) {
            this.newNode(i);
        }
    }

    newNode() { //Adds a new node
        let type = HIDDEN;
        if (this.nodes.length < this.inpSize) type = INPUT;
        else if (this.nodes.length < this.outSize + this.inpSize) type = OUTPUT;
        this.nodes.push(new Node(type)); //Add the new node to the nodes arr
    }

    predict(inps) {
        if (inps.length !== this.inpSize) {
            console.error("ERROR: INCORRECT INPUT SIZE!");
            console.error("Given Input: " + inps);
            return;
        }
        for (const node of this.nodes) {
            node.reset();
        }

        let result = [];
        for (let i = this.inpSize; i < this.inpSize + this.outSize; i++) { //Loop through all the output nodes
            result.push(this.getNodeVal(i, inps));
        }
        return result;
    }

    getNodeVal(id, inps) {
        if (this.nodes[id].type === INPUT) { //If it has reached an input
            return inps[id];
        }
        if (this.nodes[id].evaluated) {
            return this.nodes[id].val; //If it has already been calculated, just return the cached version
        }
        if (this.nodes[id].seen) { //If it is currenting calculating the value of this neuron, that means it is recurrent
            return this.nodes[id].prevVal; //Use the value from the previous time
        }
        this.nodes[id].seen = true; //A flag to be used for recurrent connections
        let sum = 0;
        for (let i = 0; i < this.nodes[id].inps.length; i++) {
            const connection = this.nodes[id].inps[i];
            if (connection.enabled) //Only add the enabled connections
                sum += connection.val * this.getNodeVal(connection.inp, inps); //Get the weighted sum of all the incoming connections
        }
        if (this.nodes[id].type === HIDDEN) sum = modifiedSigmoid(sum); //Use reLu fn for hidden nodes
        this.nodes[id].setVal(sum); //Cache the value to be reused
        this.nodes[id].evaluated = true; //It has been fully evaluated
        return this.nodes[id].val;
    }

    show(x, y, w = 150, h = 100) {
        push();
        translate(x, y);
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            if (node.posX === undefined) { //Generate the positions if the aren't generated yet
                if (node.type == INPUT) { //Set the position of the input nodes
                    node.posX = 0;
                    node.posY = (parseInt(i) + 1) * (h / (this.inpSize + 1)); //Javascript uses Strings as keys, so the id must be parsed
                } else if (node.type == OUTPUT) { //Set the position of the output nodes
                    node.posX = w;
                    node.posY = (parseInt(i) + 1 - this.inpSize) * (h / (this.outSize + 1)); //Javascript uses Strings as keys, so the id must be parsed
                } else {
                    node.posX = Math.random() * (w - 40) + 20; //Set the position of the hidden nodes
                    node.posY = Math.random() * (h - 40) + 20;
                }
            }
        }
        for (const innovNum in this.connections) {
            const connection = this.connections[innovNum];
            if (connection.enabled) {
                noFill();
                if (connection.val < 0) stroke(255, 0, 0);
                else stroke(0, 0, 255);
                strokeWeight(Math.pow(Math.abs(connection.val), 0.333) * 1.5);

                const fromNode = this.nodes[connection.inp];
                const toNode = this.nodes[connection.out];

                const midX = (fromNode.posX + toNode.posX) / 2;
                const midY = (fromNode.posY + toNode.posY) / 2;
                if (fromNode !== toNode) {
                    line(fromNode.posX, fromNode.posY, toNode.posX, toNode.posY);
                    push();
                    translate(midX, midY);
                    rotate(Math.atan2(toNode.posY - midY, toNode.posX - midX));
                    line(0, 0, -5, -2); //Draws an arrow to show the direction it is travelling in
                    line(0, 0, -5, 2);
                    pop();
                } else {
                    ellipse(fromNode.posX, fromNode.posY - 5, 7, 12); //Draw a loop to show a recurrent neuron
                }
                noStroke();
                fill(51);
                textSize(8);
                textAlign(CENTER, CENTER);
                text(innovNum + ": " + Math.round(connection.val * 1000) / 1000, midX, midY - 4);
            }
        }
        fill(50);
        noStroke();
        for (const node of this.nodes) {
            ellipse(node.posX, node.posY, 7, 7);
        }
        pop();
    }

    // getConnections() {
    //     let copyConnections = {};
    //     for (const innovNum in this.connections) {
    //         copyConnections[innovNum] = this.connections[innovNum].copy();
    //     }
    //     return copyConnections;
    // }
}

function randWeight() {
    return (Math.random() * 5) - 2.5;
    //TODO WEIGHTS CAN BE BTWN -2 AND 2??
}

function randChange() {
    return (Math.random() * 0.75) - 0.375; //TODO This can be tweaked
}

// function reLu(n) {
//     return Math.max(0, n);
// }

function modifiedSigmoid(n) {
    return 1 / (1 + Math.pow(Math.E, -4.9 * n));
}

// function noActivation(n) {
//     return n;
// }

class Genes {
    constructor() {
        this.connections = {};
        this.maxNodeID = 0; //To know how many nodes to generate
    }

    generateNodes(inpSize, outSize, connections) { //Generates all of the necessary nodes for all the connections
        let nodes = [];
        for (let id = 0; id <= this.maxNodeID; id++) {
            let type = HIDDEN;
            if (id < inpSize) type = INPUT;
            else if (id < outSize + inpSize) type = OUTPUT;
            nodes.push(new Node(type)); //Add the new node to the nodes arr
        }
        for (const innovNum in connections) {
            nodes[connections[innovNum].out].inps.push(connections[innovNum]); //Give all of the nodes the proper references to incoming connections
        }
        return nodes;
    }

    add(innovNum, connection) {
        this.connections[innovNum] = connection;
        if (connection.inp > this.maxNodeID) this.maxNodeID = connection.inp;
        if (connection.out > this.maxNodeID) this.maxNodeID = connection.out;
    }
}

class Connection {
    constructor(inp, out, val, enabled) {
        this.inp = inp; //The ID of the input node
        this.out = out; //The ID of the output node
        this.val = val; //The weight of the connection
        this.enabled = enabled; //Whether the connection is enabled or disabled
    }

    copy() {
        return new Connection(this.inp, this.out, this.val, this.enabled);
    }
}

class Node {
    constructor(type) {
        this.type = type;
        this.val = 0;
        this.prevVal = 0;
        this.evaluated = false;
        this.seen = false;

        this.inps = []; //The incoming connections
        // this.outs = []; //The outgoing connections

        this.posX = undefined; //A position for drawing
        this.posY = undefined;
    }

    setVal(val) {
        this.val = val;
    }

    setPrevVal(val) {
        this.prevVal = val;
    }

    reset() { //Reset the neuron to be ready for a new input
        this.evaluated = false;
        this.seen = false;
        this.prevVal = this.val; //Reset the next val to be set later
        this.val = 0; //For recurrence, the next val is now ready to be used
    }
}

// const connections = {

//     0: new Connection(0, 4, 1, true),
//     1: new Connection(4, 3, 2, true),
//     2: new Connection(3, 2, -1, true),
//     3: new Connection(1, 5, 7, true),
//     4: new Connection(5, 4, 5, true),
//     5: new Connection(3, 5, 3, true),



//     // 0: new Connection(0, 2, 1, true),
//     // 1: new Connection(2, 4, 2, true),
//     // 2: new Connection(4, 1, -1, true),
//     // 3: new Connection(4, 3, 3, true),
//     // 4: new Connection(3, 2, 5, true)



//     // 1: new Connection(0, 5, 2, true),
//     // 2: new Connection(1, 5, 7, true),
//     // 3: new Connection(2, 4, -3, true),
//     // 4: new Connection(5, 3, -1.5, true),
//     // 5: new Connection(5, 4, 2, true)
// }

// const NN = new NeuralNetwork(2, 1, connections);
// console.log(NN);

// console.log(NN.predict([2, 3]));
// console.log(NN.predict([-3, 4]));