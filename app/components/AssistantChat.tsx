"use client"
import React, { useRef, useState, useEffect } from 'react';
import { FiMenu, FiX, FiCheck, FiLoader, FiTrash2 } from 'react-icons/fi';
import { FaPaperPlane, FaTimesCircle, FaUserAlt, FaRobot } from 'react-icons/fa';
import axios from 'axios';
import toast from "react-hot-toast";
import { FileObject } from "openai/resources/files.mjs";
import { Thread } from "openai/resources/beta/threads/threads.mjs";
import { ThreadMessage } from "openai/resources/beta/threads/messages/messages.mjs";
import { Run } from "openai/resources/beta/threads/runs/runs.mjs";
import { AssistantFilesPage, AssistantFile } from "openai/resources/beta/assistants/files.mjs";

interface Tool {
  type: string;
}

interface Assistants {
  id: string;
  name: string;
  instructions: string;
  tools: Tool[];
}

interface Assistant {
  "assistants": {
    "id": string,
    "name": string,
    "instructions": string,
    "tools": Tool[],
  }
}

type RunState =
  | "queued"
  | "in_progress"
  | "requires_action"
  | "cancelling"
  | "cancelled"
  | "failed"
  | "completed"
  | "expired"
  | "N/A";

const AssistantChat = () => {

  // Atom State
  const [file, setFile] = useState<string | null>(null);
  const [assistantFile, setAssistantFile] = useState<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [runState, setRunState] = useState<RunState>("N/A");
  const [run, setRun] = useState<Run | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // State Assistant Operations
  const [isVisible, setIsVisible] = useState(true);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [assistantName, setAssistantName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [assistants, setAssistants] = useState<Assistants[]>([]);
  const [selectedAssistant, setSelectedAssistant] = useState<Assistant>();
  const [additionalFeatures, setAdditionalFeatures] = useState<{ code_interpreter: boolean, retrieval: boolean }>({ code_interpreter: false, retrieval: false });
  const [reload, setReload] = useState(false);

  // State File Operations
  const [fileUploading, setFileUploading] = useState(false);
  const [fileAttaching, setFileAttaching] = useState(false);
  const [fileListing, setFileListing] = useState(false);
  const [fileDeleting, setFileDeleting] = useState(false);
  const [attachedFile, setAttachedFile] = useState<AssistantFilesPage | undefined>();
  const [selectedFile, setSelectedFile] = useState<string | undefined>();

  // State Thread Operations
  const [threadCreating, setThreadCreating] = useState(false);
  const [threadDeleting, setThreadDeleting] = useState(false);

  // State Message Operations
  const [fetching, setFetching] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // State Run Operations
  const [runCreating, setRunCreating] = useState(false);
  const [pollingIntervalId, setPollingIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [runCanceling, setRunCanceling] = useState(false);

  // console.log(additionalFeatures);
  // console.log(selectedAssistant);
  // console.log(attachedFile)

  useEffect(() => {
    axios.get('/api/assistant/list')
      .then(response => setAssistants(response.data.assistants))
      .catch((error) => {
        console.error('Error:', error.response);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  useEffect(() => {
    const fetchMessages = async () => {
      setFetching(true);
      if (!thread) return;

      try {
        axios
          .get<{ messages: ThreadMessage[] }>(
            `/api/message/list?threadId=${thread.id}`
          )
          .then((response) => {
            let newMessages = response.data.messages;

            // Sort messages in descending order by createdAt
            newMessages = newMessages.sort(
              (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime()
            );
            setMessages(newMessages);
          });
      } catch (error) {
        console.log("error", error);
        toast.error("Error fetching messages", { position: "bottom-center" });
      } finally {
        setFetching(false);
      }
    };

    fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread]);

  useEffect(() => {
    // Clean up polling on unmount
    return () => {
      if (pollingIntervalId) clearInterval(pollingIntervalId);
    };
  }, [pollingIntervalId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleAssistantCreate = () => {
    const params = new URLSearchParams();
    params.append('assistantName', assistantName);
    params.append('instructions', instructions);
    Object.entries(additionalFeatures).forEach(([feature, value]) => {
      params.append(feature, String(value));
    });

    console.log(params.toString());

    axios.get('/api/assistant/create', { params })
      .then(response => {
        console.log(response.data);
        setReload(!reload);
      })
      .catch((error) => {
        console.error('Error:', error.response);
      });

    setModalIsOpen(false);
    setAssistantName('');
    setInstructions('');
    setAdditionalFeatures({ code_interpreter: false, retrieval: false });
  };

  const handleAssistantToolsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAdditionalFeatures({ ...additionalFeatures, [event.target.value]: event.target.checked });
  };

  const handleAssistantClick = (id: string) => {
    // console.log(id);
    axios.get(`/api/assistant/retrieve?id=${id}`)
      .then(response => {
        // console.log(response.data);
        setSelectedAssistant(response.data);
        setAttachedFile(undefined); // Clear attachedFile state when switching assistants
        setSelectedFile(undefined); // Clear selectedFile state when switching assistants
      })
      .catch((error) => {
        console.error('Error:', error.response);
      });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files ? event.target.files[0] : null;
    if (file) {
      handleFileUpload(file);
      // console.log(file);
    } else {
      toast.error("No file selected", { position: "bottom-center" });
    }
  };

  const handleFileUpload = async (file: File) => {
    setFileUploading(true);
    try {
      // Create a FormData object and append the file
      const formData = new FormData();
      formData.append("file", file);

      // Send the FormData object directly
      const response = await axios.post<{ file: FileObject }>(
        "/api/file/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const uploadedFile = response.data.file;

      console.log("response", uploadedFile);
      toast.success("Successfully uploaded file", {
        position: "bottom-center",
      });
      setFile(uploadedFile.id);
      localStorage.setItem("file", uploadedFile.id);
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Error uploading file", { position: "bottom-center" });
    } finally {
      setFileUploading(false);
    }
  };

  const handleFileAttach = async () => {
    setFileAttaching(true);
    try {
      const response = await axios.get<{ assistantFile: AssistantFile }>(
        `/api/assistant-file/create?assistantId=${selectedAssistant?.assistants.id}&fileId=${file}`
      );

      const assistantFile = response.data.assistantFile;

      console.log("assistantFile", assistantFile);
      toast.success("Successfully created assistant file", {
        position: "bottom-center",
      });
      setAssistantFile(assistantFile.id);
      localStorage.setItem("assistantFile", assistantFile.id);

      // Fetch the list again after successful creation
      handleFileList();
    } catch (error) {
      console.error("Error creating assistant file:", error);
      toast.error("Error creating assistant file", {
        position: "bottom-center",
      });
    } finally {
      setFileAttaching(false);
    }
  };

  const handleFileList = async () => {
    setFileListing(true);
    try {
      const response = await axios.get<{
        assistantFiles: AssistantFilesPage;
      }>(`/api/assistant-file/list?assistantId=${selectedAssistant?.assistants.id}`);

      const fetchedAssistantFiles = response.data.assistantFiles;
      setAttachedFile(fetchedAssistantFiles);
    } catch (error) {
    } finally {
      setFileListing(false);
    }
  };

  const handleFileDelete = async (selectedFile: string | undefined) => {
    if (!selectedFile) {
      console.error("No file selected");
      return;
    }
    console.log("file", selectedFile);
    setFileDeleting(true);
    try {
      await axios.get(
        `/api/assistant-file/delete?assistantId=${selectedAssistant?.assistants.id}&fileId=${selectedFile}`
      );

      toast.success("Successfully deleted assistant file", {
        position: "bottom-center",
      });
      setAssistantFile("");
      localStorage.removeItem("assistantFile");
      // After successful deletion, fetch the list again
      handleFileList();
    } catch (error) {
      console.error("Error deleting assistant file:", error);
      toast.error("Error deleting assistant file", {
        position: "bottom-center",
      });
    } finally {
      setFileDeleting(false);
    }
  };

  const handleThreadCreate = async () => {
    setThreadCreating(true);
    // console.log("create thread");
    try {
      const response = await axios.get<{ thread: Thread }>(
        "/api/thread/create"
      );

      const newThread = response.data.thread;
      console.log("response", newThread);
      setThread(newThread);
      localStorage.setItem("thread", JSON.stringify(newThread));
      toast.success("Successfully created thread", {
        position: "bottom-center",
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to create thread", { position: "bottom-center" });
    } finally {
      setThreadCreating(false);
    }
  };

  const handleThreadDelete = async () => {
    if (!thread) throw new Error("No thread to delete");

    setThreadDeleting(true);
    try {
      const response = await axios.get<{ thread: Thread }>(
        `/api/thread/delete?threadId=${thread.id}`
      );

      const deletedThread = response.data.thread;
      console.log("response", deletedThread);
      setThread(null);
      localStorage.removeItem("thread");
      setMessages([]);
      toast.success("Successfully deleted thread", {
        position: "bottom-center",
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete thread", { position: "bottom-center" });
    } finally {
      setThreadDeleting(false);
    }
  };

  const sendMessage = async () => {
    if (!thread) return;
    setSending(true);

    try {
      const response = await axios.post<{ message: ThreadMessage }>(
        `/api/message/create?threadId=${thread.id}&message=${message}`,
        { message: message, threadId: thread.id }
      );

      const newMessage = response.data.message;
      console.log("newMessage", newMessage);
      setMessages([...messages, newMessage]);
      setMessage("");
      toast.success("Successfully sent message", {
        position: "bottom-center",
      });
      handleRunCreate();
    } catch (error) {
      console.log("error", error);
      toast.error("Error sending message", { position: "bottom-center" });
    } finally {
      setSending(false);
    }
  };

  const handleRunCreate = async () => {
    if (!selectedAssistant || !thread) return;

    setRunCreating(true);
    try {
      const response = await axios.get<{ run: Run }>(
        `/api/run/create?threadId=${thread.id}&assistantId=${selectedAssistant.assistants.id}`
      );

      const newRun = response.data.run;
      setRunState(newRun.status);
      setRun(newRun);
      toast.success("Run created", { position: "bottom-center" });
      localStorage.setItem("run", JSON.stringify(newRun));

      // Start polling after creation
      startPolling(newRun.id);
    } catch (error) {
      toast.error("Error creating run.", { position: "bottom-center" });
      console.error(error);
    } finally {
      setRunCreating(false);
    }
  };

  const startPolling = (runId: string) => {
    if (!thread) return;
    const intervalId = setInterval(async () => {
      try {
        const response = await axios.get<{ run: Run }>(
          `/api/run/retrieve?threadId=${thread.id}&runId=${runId}`
        );
        const updatedRun = response.data.run;

        setRun(updatedRun);
        setRunState(updatedRun.status);

        if (
          ["cancelled", "failed", "completed", "expired"].includes(
            updatedRun.status
          )
        ) {
          clearInterval(intervalId);
          setPollingIntervalId(null);
          fetchMessages();
        }
      } catch (error) {
        console.error("Error polling run status:", error);
        clearInterval(intervalId);
        setPollingIntervalId(null);
      }
    }, 500);

    setPollingIntervalId(intervalId);
  };

  const fetchMessages = async () => {
    if (!thread) return;

    try {
      axios
        .get<{ messages: ThreadMessage[] }>(
          `/api/message/list?threadId=${thread.id}`
        )
        .then((response) => {
          let newMessages = response.data.messages;

          // Sort messages in descending order by createdAt
          newMessages = newMessages.sort(
            (a, b) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()
          );
          setMessages(newMessages);
        });
    } catch (error) {
      console.log("error", error);
      toast.error("Error fetching messages", { position: "bottom-center" });
    }
  };

  const handleRunCancel = async () => {
    if (!run || !thread) return;

    setRunCanceling(true);
    try {
      const response = await axios.get<{ run: Run }>(
        `/api/run/cancel?runId=${run.id}&threadId=${thread.id}`
      );

      const newRun = response.data.run;
      setRunState(newRun.status);
      setRun(newRun);
      toast.success("Run canceled", { position: "bottom-center" });
      localStorage.setItem("run", JSON.stringify(newRun));
    } catch (error) {
      toast.error("Error canceling run.", { position: "bottom-center" });
      console.error(error);
    } finally {
      setRunCanceling(false);
    }
  };

  return (
    <div className="flex flex-row w-full h-screen">

      {/* サイドメニューエリア */}
      <div className="relative bg-slate-900 text-slate-200">

        {/* メニュー閉ボタン */}
        {isVisible && (
          <div className="p-4 w-96 h-full overflow-auto">
            <button
              className="absolute top-0 right-0 m-2"
              onClick={() => setIsVisible(!isVisible)}
            >
              <FiX size={20} />
            </button>

            {/* アシスタント作成ボタン */}
            <button
              className="mx-auto mt-4 p-4 px-8 rounded block bg-slate-800 hover:bg-slate-700"
              onClick={() => setModalIsOpen(true)}
            >
              アシスタント新規作成
            </button>

            <hr className='mt-8 mb-5' style={{ borderColor: 'white' }} />

            {/* アシスタント一覧 */}
            <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'scroll' }}>
              {assistants.map((assistant) => (
                <div key={assistant.id} className={`my-2 p-2 rounded h-10 flex items-center ${selectedAssistant?.assistants.id === assistant.id ? 'bg-gray-300' : 'hover:bg-gray-300'}`} onClick={() => handleAssistantClick(assistant.id)}>
                  <h3 className="truncate">{assistant.name}</h3>
                </div>
              ))}
            </div>

            {/* アシスタント作成用モーダル */}
            {modalIsOpen && (
              <div className="fixed z-10 inset-0 overflow-y-auto">
                <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                  <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                    <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                  </div>
                  <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                  <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                      <h2 className="text-black mb-4">アシスタント新規作成</h2>
                      <label className="text-black">アシスタント名</label>
                      <input type="text" value={assistantName} onChange={(e) => setAssistantName(e.target.value)} placeholder="アシスタント名" className="text-black bg-gray-200 block w-full mt-2 mb-2" />
                      {!assistantName && <p className="text-red-500">空白のまま送信できません</p>}
                      <label className="text-black">指示</label>
                      <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="指示" className="text-black bg-gray-200 block w-full mt-2 mb-2 h-96" />
                      {!instructions && <p className="text-red-500">空白のまま送信できません</p>}
                      <label className="text-black">追加機能</label>
                      <div className="mt-2">
                        <input type="checkbox" id="codeInterpreter" name="codeInterpreter" value="code_interpreter" checked={additionalFeatures.code_interpreter} onChange={handleAssistantToolsChange} />
                        <label htmlFor="codeInterpreter" className="text-black">コードインタープリター</label>
                      </div>
                      <div className="mt-2">
                        <input type="checkbox" id="fileSearch" name="fileSearch" value="retrieval" checked={additionalFeatures.retrieval} onChange={handleAssistantToolsChange} />
                        <label htmlFor="fileSearch" className="text-black">ファイル検索(まだ対応してないよ)</label>
                      </div>
                    </div>
                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row">
                      <button onClick={() => setModalIsOpen(false)} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm">
                        キャンセル
                      </button>
                      <button onClick={handleAssistantCreate} disabled={!assistantName || !instructions} className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm">
                        送信
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* メニュー開ボタン */}
        {!isVisible && (
          <button
            className="absolute top-0 left-0 m-2 text-black"
            onClick={() => setIsVisible(!isVisible)}
          >
            <FiMenu size={20} />
          </button>
        )}
      </div>

      {/* チャットエリア */}
      <div className="w-full overflow-auto bg-slate-50">
        <div className="p-4 text-slate-500 border-t border-gray-200 h-full">
          <h1 className="text-4xl font-bold mb-5">Assistant API Sample</h1>

          {/* アシスタント情報表示 */}
          {selectedAssistant && (
            <>
              <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-4">
                <details open>
                  <summary className="px-4 py-5 sm:px-6 cursor-pointer">
                    <h2 className="text-lg leading-6 font-medium text-gray-900">Assistant Information</h2>
                    <p className="mt-1 max-w-2xl text-sm text-gray-500">Details about the selected assistant. Click to expand.</p>
                  </summary>
                  <div className="border-t border-gray-200">
                    <dl>
                      <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Assistant ID</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{selectedAssistant.assistants.id}</dd>
                      </div>
                      <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Name</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{selectedAssistant.assistants.name}</dd>
                      </div>
                      <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Instructions</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{selectedAssistant.assistants.instructions}</dd>
                      </div>
                      <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Tools</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                          {selectedAssistant.assistants.tools.length > 0 ? (
                            <ul className="border border-gray-200 rounded-md divide-y divide-gray-200">
                              {selectedAssistant.assistants.tools.map((tool, index) => (
                                <li key={index} className="pl-3 pr-4 py-3 flex items-center justify-between text-sm">
                                  <div className="w-0 flex-1 flex items-center">
                                    <FiCheck className="flex-shrink-0 h-5 w-5 text-green-500" />
                                    <span className="ml-2 flex-1 w-0 truncate">{tool.type}</span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-gray-500">No tools applied</p>
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </details>
              </div>

              {/* ファイルアップロードボタン */}
              <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-4">
                <details open>
                  <summary className="px-4 py-5 sm:px-6 cursor-pointer">
                    <h2 className="text-lg leading-6 font-medium text-gray-900">File Upload</h2>
                    <p className="mt-1 max-w-2xl text-sm text-gray-500">Details about the file upload. Click to expand.</p>
                  </summary>
                  <div className="border-t border-gray-200">
                    <dl>
                      <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Upload File</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            style={{ display: "none" }}
                          />
                          <div className="flex space-x-4 mt-2">
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              disabled={fileUploading}
                              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-10 py-8 bg-primary text-primary-foreground w-36 bg-slate-300"
                            >
                              {fileUploading ? "Uploading..." : "Upload"}
                            </button>
                            <button
                              onClick={handleFileAttach}
                              disabled={!file}
                              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-10 py-8 bg-primary text-primary-foreground w-36 bg-slate-300"
                            >
                              {fileAttaching ? "Attaching..." : "Attach"}
                            </button>
                            <button
                              onClick={handleFileList}
                              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-10 py-8 bg-primary text-primary-foreground w-36 bg-slate-300"
                            >
                              {fileListing ? "Listing..." : "List"}
                            </button>
                          </div>
                        </dd>
                      </div>
                      <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Attached Files</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                          {attachedFile ? (
                            attachedFile.data.length > 0 ? (
                              attachedFile.data.map((file, index) => (
                                <div key={index} className="flex items-center mt-2" style={{ minHeight: '24px' }}>
                                  <input type="radio" id={file.id} name="attachedFile" value={file.id} onChange={(e) => setSelectedFile(e.target.value)} className="form-radio h-4 w-4 text-blue-600" checked={selectedFile === file.id} />
                                  <label htmlFor={file.id} className="ml-2 block text-sm text-gray-900">{file.id}</label>
                                  {selectedFile === file.id && (
                                    <button onClick={() => handleFileDelete(selectedFile)} disabled={!selectedFile} className="ml-2 py-1 px-2 bg-slate-500 text-white rounded">
                                      {fileDeleting ? <FiLoader /> : <FiTrash2 />}
                                    </button>
                                  )}
                                </div>
                              ))
                            ) : (
                              <p>No attached files.</p>
                            )
                          ) : (
                            <p>Click the List button to check attached files.</p>
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </details>
              </div>
              <hr className='mt-5 mb-5' />

              {/* スレッド作成・選択エリア */}
              <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Thread Operations</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  <div className="flex flex-row gap-x-4 w-full">
                    <button
                      onClick={handleThreadCreate}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-10 py-8 bg-primary text-primary-foreground w-36 bg-slate-300"
                    >
                      {threadCreating ? "Creating..." : "Create New"}
                    </button>
                    <button
                      onClick={handleThreadDelete}
                      disabled={!thread}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-10 py-8 bg-primary text-primary-foreground w-36 bg-slate-300"
                      >
                      {threadDeleting ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </dd>
              </div>
              <hr className='mt-5 mb-5' />

              {/* メッセージエリア */}
              {/* <textarea className="w-full p-2 border border-gray-200 rounded" placeholder="Type a message..."></textarea>
              <button className="mt-2 px-4 py-2 bg-blue-500 text-white rounded" type="button">Send</button> */}
              <div className="flex flex-col w-full h-full max-h-screen rounded-lg border-slate-200 border-solid border-2 p-10">
                {/* Messages */}
                <div className="flex flex-col h-full overflow-y-auto border-slate-200 border-solid border-2 p-6 rounded-lg">
                  {fetching && <div className="m-auto font-bold">Fetching messages.</div>}
                  {!fetching && messages.length === 0 && (
                    <div className="m-auto font-bold">No messages found for thread.</div>
                  )}
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`px-4 py-2 mb-3 rounded-lg text-white w-fit text-lg ${message.role === "user"
                        ? " bg-slate-500 ml-auto text-right"
                        : " bg-slate-800"
                        }`}
                    >
                      <div className="flex items-center">
                        {message.role === "user" ? <FaUserAlt className="mr-2" /> : <FaRobot className="mr-2" />}
                        <div className="flex-grow">
                          {message.content[0].type === "text"
                            ? message.content[0].text.value
                            : null}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="flex flex-row w-full mt-5">
                  <div className="flex-grow rounded-lg border-slate-200 border-solid border-2 p-2">
                    <textarea
                      className="w-full"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-row">
                    <button
                      disabled={!thread || sending || message === ""}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-xl font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-10 py-8 bg-primary text-primary-foreground bg-slate-800 text-white p-2 ml-4 disabled:bg-slate-200"
                      onClick={() => {
                        sendMessage();
                      }}
                    >
                      <FaPaperPlane />
                    </button>

                    {/* Run */}
                    <button
                      onClick={handleRunCancel}
                      disabled={["N/A"].includes(runState) || !run}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-xl font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-10 py-8 bg-primary text-primary-foreground bg-slate-800 text-white p-2 ml-4 disabled:bg-slate-200"
                    >
                      <FaTimesCircle />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssistantChat;
