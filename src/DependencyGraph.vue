<template>
  <div class="DependencyGraph">
    <div id="network"></div>
  </div>
</template>

<script>
import cytoscape from "cytoscape";
import fcose from 'cytoscape-fcose'
import axios from "axios";

export default {
  name: 'DependencyGraph',
  data() {
    return {
      data: [],
      entityRoot: [],
      parentIdMap: new Map(),
      entityIdMap: new Map(),
      relations: [],
    }
  },
  created() {
    this.getEntity()
  },
  methods: {
    getRelationCategory(cell) {
      for (const key of Object.keys(cell["values"])) {
        if (key === "loc" || key === "bindVar" || key === "modifyAccessible" || key === "invoke" || key === "arguments") {
          continue;
        }
        return key;
      }
      return undefined;
    },
    async getRelationsByIds(entityIds) {
      const relations = []
      for (const cell of this.data["cells"]) {
        if (entityIds.has(cell["src"]) && entityIds.has(cell["dest"])) {
          relations.push(cell);
        }
      }
      return relations;
    },
    async getChildrenById(entityId) {
      if (!this.parentIdMap.has(entityId)) {
        return [];
      }
      return this.parentIdMap.get(entityId);
    },
    async getData() {
      const params = JSON.stringify({
        rootDir: "/Users/ba1man/Work/build/unicom/server",
        lang: "java",
        projectName: "server",
      })
      const config = {
        headers: {
          'Content-Type': 'application/json'
        }
      }
      const result = await axios.post('http://localhost:8888/extract/enre', params, config);
      this.data = result.data.data;
      for (const variable of this.data["variables"]) {
        this.entityIdMap.set(variable["id"], variable);
        if (!this.parentIdMap.has(variable["parentId"])) {
          this.parentIdMap.set(variable["parentId"], []);
        }
        this.parentIdMap.get(variable["parentId"]).push(variable);
      }
    },
    async getEntity() {
      await this.getData();
      this.entityRoot = []
      this.entityRoot.push({group: 'nodes', data: {id: '-1', name: ''}})
      let _this = this;
      _this.getChildrenById(-1).then((res) => {
        res.forEach(node => {
          _this.entityRoot.push({
            group: 'nodes',
            data: {id: node["id"], name: node["name"], parent: '41576', classes: 'center-center'}
          })
        })
      })
      console.log(_this.entityRoot);
      cytoscape.use(fcose);
      let cy = cytoscape({
        container: document.getElementById('network'),
        ready: function () {
          this.nodes().forEach(function (node) {
            let size = 50;
            node.css("width", size);
            node.css("height", size);
          });
          // this.layout({name: 'fcose', fit: true, nodeRepulsion: 99999,initialEnergyOnIncremental: 0.1,nestingFactor:0.1, animationEasing: 'ease-out'}).run();
        },
        layout: {
          name: "fcose",
          fit: true,
          nodeRepulsion: 99999,
          animationDuration: 300,
          spacingFactor: 1.8,
          nodeDimensionsIncludeLabels: false,
        },
        // zoomingEnabled: false,
        // userZoomingEnabled: false,
        maxZoom: 1,
        minZoom: 1,
        style: [
          {
            selector: 'node',
            style: {
              'label': 'data(name)',
              'font-size': '14px',
              'background-opacity': 0.6,
              'background-color': '#2B65EC'
            }
          },

          {
            selector: ':parent',
            style: {
              'background-opacity': 0.2,
              'border-color': '#62f'
            }
          },

          {
            selector: 'edge',
            style: {
              'label': 'data(category)',
              'line-color': '#2B65EC'
            }
          },

          {
            selector: 'node:selected',
            style: {
              'background-color': '#F08080',
              'border-color': 'red'
            }
          },

          {
            selector: 'edge:selected',
            style: {
              'line-color': '#F08080'
            }
          }
        ],
        elements: _this.entityRoot,
      });
      cy.on('tap', 'node', function (evt) {
        let target = evt.target;
        console.log(target);
        if (target.selected()) {
          target.children().forEach(ele => {
            cy.remove(ele)
          });
        } else {
          let edgesParam = new Set();
          _this.getChildrenById(Number(target.id())).then((res) => {
            res.forEach(node => {
              cy.add({
                group: 'nodes',
                data: {id: node["id"], name: node["name"], parent: target.id(), classes: 'center-center'}
              })
            });
          })
          cy.elements().forEach(ele => {
            edgesParam.add(Number(ele.data().id));
          });
          _this.getRelationsByIds(edgesParam).then((res) => {
            res.forEach(edge => {
              const cat = _this.getRelationCategory(edge);
              if (cat !== 'Contain' && cat !== 'Define') {
                cy.add({
                  group: 'edges',
                  data: {id: edge.id, source: String(edge["src"]), target: String(edge["dest"]), category: cat}
                })
              }
            });
          });
          let layout = cy.layout({
            name: "fcose",
            fit: true,
            nodeRepulsion: 99999,
            randomize: true,
            animationDuration: 300,
            padding: 30,
            nodeDimensionsIncludeLabels: false,
            initialEnergyOnIncremental: 0.5,
            nestingFactor: 0.5,
            spacingFactor: 2,
          })
          layout.run()
        }
      });
    },
  }
}
</script>

<style lang="scss" scoped>
.title-header {
  margin: 1em 0 0.5em;
}

.over-view {
  width: max(50vw, 800px);
}

#network {
  width: 100%;
  height: max(65vh, 800px);
  overflow: auto;
  border: 1px solid #69f;
}
</style>