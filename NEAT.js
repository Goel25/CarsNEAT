//Paper desribing the algorithm: http://nn.cs.utexas.edu/downloads/papers/stanley.ec02.pdf
//This project was created by Leo Gagnon on Nov 29, 2019
class NEAT {
    constructor(options) { //popSize, inpSize, outSize, constants, compatThresh) {
        this.consts = [options.disjointConst, options.excessConst, options.weightConst];
        this.mutateProbs = [
            options.shiftWeightProb,
            options.changeWeightProb,
            options.enabledDisableProb,
            options.splitConnectionProb,
            options.newConnectionProb
        ];
        this.desAmtOfSpecies = options.amtOfSpecies || 5;
        this.compatMod = options.compatThreshMod || 0.3;
        this.compatThreshold = options.defaultCompatThresh || 1.4;

        this.innovations = { //The innovation number is stored in an object to it can be used as a reference
            "num": 0,
            "innovations": {}
        };
        this.generation = 0;

        this.inpSize = options.inpSize;
        this.outSize = options.outSize;


        this.popSize = options.populationSize;
        this.pop = [];
        for (let i = 0; i < this.popSize; i++) { //Create an initial population
            const newMember = new NeuralNetwork(this.inpSize, this.outSize, this.innovations);
            this.pop.push(newMember);
        }
        this.speciId = -1; //The ID of the current speci. Starts at -1 so that the first speci is 0
        this.speciRepresentatives = {}; //A dict with all of the representative genomes. The key is the speci Id
        this.speciCounts = []; //An array of dicts that keeps track of how many members are in each speci each gen
    }
    /** //TODO!
        > SurvivalThreshold 0.2 [?]
        Only the top 20% of each species is allowed to reproduce. Controls greediness within species.

        > MutationPower 2.5 [?]
        Mutations of weight go up to 2.5 in a single mutation. You wouldn't want it over 5.0 or so.
     */

    nextGen() {
        let newPop = [];
        let totalFit = 0;
        for (let i = 0; i < this.pop.length; i++) {
            // this.pop[i].fitness *= this.pop[i].fitness;
            this.pop[i].fitness = Math.sqrt(this.pop[i].fitness);
            totalFit += this.pop[i].fitness;
        }
        // const totalFit = this.pop.reduce((sum, curr) => sum + curr.fitness);

        for (let i = 0; i < this.popSize; i++) {
            const parentAIndex = this.getWeightedSpeciIndex(this.pop, totalFit);
            const parentA = this.pop[parentAIndex];

            let parentBIndex = this.getWeightedSpeciIndex(this.pop, totalFit);
            for (let i = 0; i < 1000 && parentAIndex === parentBIndex; i++) {
                parentBIndex = this.getWeightedSpeciIndex(this.pop, totalFit);
            }
            let parentB = this.pop[parentBIndex];

            let child;
            if (parentA.fitness > parentB.fitness) { //Crossover differently depending on the fitnesses
                child = this.crossover(parentA, parentB); //TODO When crossed between species, the fitness metric is not adjusted
            } else if (parentA.fitness < parentB.fitness) {
                child = this.crossover(parentB, parentA);
            } else {
                child = this.crossover(parentA, parentB, true); //If the fitness is equal, disjoint/excess should be inherited from both
            }
            //------------------------Mutation------------------------
            child.mutate(this.mutateProbs); //Mutate the child
            newPop.push(child); //Add to the new population
        }
        // console.log("Amt of Species: " + Object.keys(species).length);
        this.pop = newPop;
        this.generation++;
    }

    getWeightedSpeciIndex(arr, total) { //Uses a weighted probability (based on fitness) to pick a random member from a speci's arr
        let r = Math.random() * total;
        let index = Math.floor(Math.random() * arr.length) - 1; //Starts with a random member, to prevent a normal distribution
        do { //A do while loop is used because Math.random() is inclusive of 0, in which case -1 would be returned
            index = (index + 1) % arr.length;
            r -= arr[index].fitness;
        } while (r >= 0);
        return index;
    }

    getWeightedSpeciesIndex(dict, total) { //Uses a weighted probability (based on fitness) to pick a random speci from a dict of species
        let keys = Object.keys(dict);
        let r = Math.random() * total;
        let keysIndex = Math.floor(Math.random() * keys.length) - 1; //Starts with a random member, to prevent a normal distribution
        do { //A do while loop is used because Math.random() is inclusive of 0, in which case -1 would be returned
            keysIndex = (keysIndex + 1) % keys.length;
            r -= dict[keys[keysIndex]].adjFit;
        } while (r >= 0);
        return keys[keysIndex];
    }

    compatability(aConnections, bConnections) { //How closely relate 2 organisms are. Used for speciation
        let amtDisjoint = 0; //The amount of disjoint genes (genes without a matching pair)
        let amtExcess = 0; //The amount of excess genes (extra genes from the individual w/ a larger genome)

        let totalWeightDiff = 0; //The avg difference of all of the matching genes weights
        let matchingGenes = 0; //The amount of matching genes (used to calc the avg)

        const innovNumsA = Object.keys(aConnections);
        const innovNumsB = Object.keys(bConnections);
        const maxInnovA = Math.max(...innovNumsA);
        const maxInnovB = Math.max(...innovNumsB);
        //TODO Readd not normalizing smaller gneomes?
        let biggerGenome = Math.max(innovNumsA.length, innovNumsB.length); //The amount of genes in the bigger genome (used for normalizing)
        // if (biggerGenome < 20) biggerGenome = 1; //Not necessary to normalize smaller genomes (recommended by the paper)
        let smallerGenome = Math.min(maxInnovA, maxInnovB); //The largest innovation number of the simplier (older innovations) individual (used for calculating excess genes)

        for (const innovNum in aConnections) {
            if (innovNum in bConnections) { //There is a matching pair
                totalWeightDiff += Math.abs(aConnections[innovNum].val - bConnections[innovNum].val); //Add the diff btwn the 2
                matchingGenes++; //Used for avg
            } else if (innovNum <= smallerGenome) { //If it's disjoint
                amtDisjoint++;
            } else { //If it's excess
                amtExcess++;
            }
        }
        for (const innovNum in bConnections) {
            if (!(innovNum in aConnections)) { //All the matching have been evaluated, so don't include thos
                if (innovNum <= smallerGenome) { //If it's disjoint
                    amtDisjoint++;
                } else {
                    amtExcess++;
                }
            }
        }
        return ((this.consts[0] * amtExcess) / biggerGenome) + ((this.consts[1] * amtDisjoint) / biggerGenome) + (this.consts[2] * (totalWeightDiff / matchingGenes));
    }

    crossover(a, b, equalFit = false) { //Crossover 2 organisms (a is the more fit parent)
        let childGenes = new Genes();
        for (const innovNum in a.connections) {
            if (innovNum in b.connections) { //If both parents have that gene
                if (Math.random() < 0.5) childGenes.add(innovNum, a.connections[innovNum].copy()); //Pick a random gene from each parent
                else childGenes.add(innovNum, b.connections[innovNum].copy());
            } else { //Only parent a has that gene
                childGenes.add(innovNum, a.connections[innovNum].copy());
            }
        }
        if (equalFit) { //If they are equally fit, dijoint/excess genes are added from both parents
            for (const innovNum in b.connections) {
                if (!(innovNum in childGenes)) { //Add disjoint genes from the other parent
                    childGenes.add(innovNum, b.connections[innovNum].copy());
                }
            }
        }

        let child = new NeuralNetwork(this.inpSize, this.outSize, this.innovations, childGenes);
        return child;
    }

    showSpeciGraph(x, y, w) {
        let speciHeight = w / this.speciCounts.length;
        push();
        translate(x, y);
        fill(0);
        stroke(0);
        strokeWeight(2);
        rect(0, 0, w, w);
        noStroke();
        // strokeWeight(2);
        for (let gen = 0; gen < this.speciCounts.length; gen++) {
            let percent = 0;
            let total = Object.values(this.speciCounts[gen]).reduce((total, curr) => total + curr);
            for (const speciId in this.speciCounts[gen]) {
                const count = this.speciCounts[gen][speciId];
                let thisPercent = count / total;
                const col = genSpeciCol(speciId);
                fill(col[0], col[1], col[2]);
                // stroke(col[0], col[1], col[2]);
                rect(percent * w, w - ((gen + 1) * speciHeight), thisPercent * w, speciHeight);
                percent += thisPercent;
            }
        }
        pop();
    }

    show() {
        let i = 0;
        for (let y = 25; y < height - 25; y += 100) {
            for (let x = 25; x < width - 225; x += 200) {
                if (i >= this.popSize) return;
                this.pop[i].show(x, y);
                i++;
            }
        }
    }
}

function genSpeciCol(id) { //Return an [r, g, b] that will be the same for the same id, but diff for diff ids (used to show speci graph)
    return [
        ((id + 57) * 431) % 255,
        ((id + 89) * 124) % 255,
        ((id + 173) * 956) % 255,
    ]
}

class Speci {
    constructor() {
        this.fit = 0;
        this.adjFit = 0;
        this.bestMember = null;
        this.members = [];
    }

    keepBest(perc) {
        const amtToKeep = Math.ceil(this.members.length * perc); //TODO Just sort the array (maybe when adding members), and then remove most of the members below n%
        this.members = this.members.sort((a, b) => a.fitness - b.fitness);
        this.members = this.members.slice(0, amtToKeep);
        // for (let i = this.members.length - 1; i >= 0; i++) {
        //     if (i < amtToKeep && Math.random() < 0.1) {
        //         this.members.splice(i, 1);
        //     }
        //     if (i > amtToKeep && Math.random() < 0.95) {
        //         this.members.splice(i, 1);
        //     }
        // }
        //TODO TODO TODO TODO TODO TODO TODO
        // let keep = [];
        // let lowestKept = -Infinity;
        // for (let i = 0; i < this.members.length; i++) {
        //     if (keep.length < amtToKeep || this.members[i].fitness > lowestKept) {
        //         keep.push(this.members[i]);
        //         if (keep.length >= amtToKeep) lowestKept = this.members[i].fitness;
        //     }
        // }
        // return keep;
    }

    // getMin(arr) {

    // }

    getAdjFit() { //TODO MAYBE CHANGE THIS???? //Math.sqrt(this.fit);???
        this.adjFit = this.fit / this.members.length;
        return this.adjFit;
    }

    addMember(m) {
        this.members.push(m);
        this.fit += m.fitness;
        if (!this.bestMember || m.fitness > this.bestMember.fitness) this.bestMember = m;
    }

    // calcFits() {
    //     // this.fit = 0;
    //     for (const member of this.members) {
    //         this.fit += member.fitness;
    //     }
    //     this.adjFit = this.fit / this.members.length;
    // }

    // getBestMember() {
    //     let bestFit = -Infinity;
    //     let best = null;
    //     for (const member of this.members) {
    //         if (member.fitness > bestFit) {
    //             bestFit = member.fitness;
    //             best = member;
    //         }
    //     }
    //     return best.copy();
    // }


}