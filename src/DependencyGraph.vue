<template>
  <div class="DependencyGraph">
    <div id="network"></div>
  </div>
</template>

<script>
import cytoscape from "cytoscape";
import fcose from 'cytoscape-fcose'
import axios from "axios";
import { vscode } from "./utilities/vscode.ts";

export default {
  name: 'DependencyGraph',
  data() {
    return {
      projectName: "depends",
      data: [],
      entityRoot: [],
      parentIdMap: new Map(),
      entityIdMap: new Map(),
      relations: [],
      configData: {},
      type: "",
      packageList:[]
    }
  },
  created() {
    // this.getEntity()
    // this.getConfig()
    this.configData={
      "targetFilePath": "D:\\git\\refactor-service-test\\depends.con.json",
        "projectRoot": "D:\\git\\refactor-service-test\\test\\depends",
        "projectName": "depends",
    }
    //dependency,target
    this.type = 'dependency';
    this.getEntity()
  },
  mounted() {
    window.addEventListener('message', event => {
      const message = event.data; // The json data that the extension sent
      switch (message.command) {
        case 'setConfig':
          {
            console.log(message.configData);
            this.configData = JSON.parse(message.configData);
            this.type = message.type;
            this.getEntity()
            // this.getArchModelData()
            break;
          }
      }
    })
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
    //目标模型的cell加一个判断类型，把父子节点的边不显现。
    async getRelationsByIdsTarget(entityIds) {
      const relations = []
      for (const cell of this.data["cells"]) {
        if (entityIds.has(cell["src"]) && entityIds.has(cell["dest"])) {
          let category='Relation'
          let cn=this.packageList.find(n=>n.id==cell["dest"]+'');
          if(cn.parentId==cell["src"]+''){
            category='Contain'
          }
          let c={src:cell["src"],dest:cell["dest"],category:category}
          relations.push(c);
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
    async buildVariableList(variables) {
      const nameIdMap = new Map();
      const resultList = [];
      variables.forEach((variable, i) => {
        nameIdMap.set(variable, i + 1);
        let parentId;
        if (!variable.includes("/")) {
          parentId = -1;
        } else {
          parentId = nameIdMap.get(variable.slice(0, variable.lastIndexOf("/")));
        }
        resultList.push({
          "id": i + 1,
          "name": variable,
          "parentId": parentId,
        });
      });
      return resultList;
    },
    async getArchModelData() {
      const params = JSON.stringify({
        "filePath": this.configData.targetFilePath,
        "rootDir": this.configData.projectRoot,
        "projectName": this.configData.projectName,
      });
      const config = {
        headers: {
          'Content-Type': 'application/json'
        }
      };
      const result = await axios.post('http://localhost:8888/target/upload', params, config);
      this.data = result.data.data;
      console.log(this.data);
      this.packageList = await this.buildVariableList(this.data["variables"]);
      this.packageList.forEach((variable) => {
        this.entityIdMap.set(variable.id, variable);
        if (!this.parentIdMap.has(variable.parentId)) {
          this.parentIdMap.set(variable.parentId, []);
        }
        this.parentIdMap.get(variable.parentId).push(variable);
      });
    },
    async getData() {
      const params = JSON.stringify({
        rootDir: this.configData.projectRoot,
        lang: "java",
        projectName: this.configData.projectName,
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
      vscode.postMessage({//向vscode插件通信
        command: "hello",
        text: "Dependendcy analysis finished",
        })
      },
    async getEntity() {
      if (this.type == 'dependency') await this.getData();
      else await this.getArchModelData();
      this.entityRoot = []
      this.entityRoot.push({group: 'nodes', data: {id: '-1', name: ''}})
      let _this = this;
      _this.getChildrenById(-1).then((res) => {
        res.forEach(node => {
          _this.entityRoot.push({
            group: 'nodes',
            data: {id: node["id"], name: node["name"], parent: '-1', classes: 'center-center'}
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
          if (_this.type == 'target') {
            _this.getRelationsByIdsTarget(edgesParam).then((res) => {
              res.forEach(edge => {
                  const cat = edge.category;
                  if (cat !== 'Contain' && cat !== 'Define') {
                    cy.add({
                      group: 'edges',
                      data: { id: edge.id, source: String(edge["src"]), target: String(edge["dest"]), category: edge.category }
                    })
                  }
                });
            });
          }else{
            _this.getRelationsByIds(edgesParam).then((res) => {
              res.forEach(edge => {
                const cat = _this.getRelationCategory(edge);
                // console.log(cat)
                  if (cat !== 'Contain' && cat !== 'Define') {
                    cy.add({
                    group: 'edges',
                    data: {id: edge.id, source: String(edge["src"]), target: String(edge["dest"]), category: cat}
                  })
                }
              });
            });
          }          
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
async getConfig() {
      vscode.postMessage({
        command: 'setConfig'
      })
    }
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