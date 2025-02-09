import { MemorySaver } from "@langchain/langgraph";
import { SecretVaultWrapper } from "nillion-sv-wrappers";
export class NillionMemorySaver extends MemorySaver {
  /**
   * @param {object} orgConfig - Configuration for the Nillion vault (nodes, credentials, etc.)
   * @param {string} schemaId - (Optional) Your schema identifier, if you use it elsewhere in your code
   * @param {object} options - Additional options if needed
   */
  orgConfig;
  schemaId;
  initialized;
  vault;
  memory;
  recordIds;

  constructor(orgConfig, schemaId, options = {}) {
    super({
      dumpsTyped: (data) => [JSON.stringify(data), new Uint8Array()],
      loadsTyped: (data) => JSON.parse(data),
      ...options,
    });
    this.orgConfig = orgConfig;
    this.schemaId = schemaId; // You can keep this for your own usage if needed.
    this.initialized = false;
    // **Remove the third argument from SecretVaultWrapper!**
    this.vault = new SecretVaultWrapper(
      this.orgConfig.nodes,
      this.orgConfig.orgCredentials
    );
    this.recordIds = [];
  }

  async initVault() {
    // Perform any initialization required.
    this.initialized = true;
  }

  async saveMemory() {
    await this.initVault();
    const data = { conversation: this.memory || [] };
    try {
      const dataWritten = await this.vault.writeToNodes(data);
      console.log("Memory persisted to Nillion:", dataWritten);
      this.recordIds = [
        ...new Set(dataWritten.map((item) => item.result.data.created).flat()),
      ];
    } catch (error) {
      console.error("Error saving memory to Nillion:", error);
    }
  }

  async loadMemory() {
    await this.initVault();
    try {
      const decryptedData = await this.vault.readFromNodes({});
      console.log("Decrypted data:", decryptedData);
      if (decryptedData && decryptedData.length) {
        const conversationData = decryptedData[0].conversation || [];
        this.memory = conversationData;
        console.log("Loaded conversation memory from Nillion.");
        return conversationData;
      }
    } catch (error) {
      console.error("Error loading memory from Nillion:", error);
    }
    return [];
  }

  async updateMemory(newMessage) {
    this.memory = this.memory || [];
    this.memory.push(newMessage);
    console.log("Saved new message. Updating memory...");
    await this.saveMemory();
  }
}
