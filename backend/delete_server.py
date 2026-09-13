from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

URL = os.getenv("SUPABASE_URL")
SECRET = os.getenv("SUPABASE_SECRET_KEY")
sb = create_client(URL, SECRET)

class DeleteReq(BaseModel):
    password: str
    email: str

@app.get("/health")
def health():
    return {"status": "ok"}

@app.delete("/delete-account")
def delete_account(req: DeleteReq):
    try:
        sb.auth.sign_in_with_password({"email": req.email, "password": req.password})
    except Exception:
        raise HTTPException(status_code=400, detail="Contrasena incorrecta")

    try:
        sb.table("rostros").delete().eq("usuario_id",
            sb.table("usuarios").select("id").eq("email", req.email).execute().data[0]["id"]
        ).execute()
    except Exception:
        pass

    try:
        sb.table("usuarios").delete().eq("email", req.email).execute()
    except Exception:
        pass

    try:
        users = sb.auth.admin.list_users()
        for u in users:
            if u.email == req.email:
                sb.auth.admin.delete_user(u.id)
                break
    except Exception:
        pass

    return {"success": True}
