import uuid

def get_new_message_id():
    return str(uuid.uuid4())

def get_new_trace_id():
    return str(uuid.uuid4())

def assembly_message(type, format, content, **kwargs):
    """
        {
            "type": "assistant",
            "format": "html", 
            "content": "xxxxx",
            "content_type": "xxxxx", 
            "section": "tool",
            “template”:
            "message_id": "xxxxx"
        }
        type: role
        format: text/img
        section: reason/tool/response

        content:
            str,
            dict
    """
    try:
        output_message = {"type": type, "format": format, "content": content}

        keys = ["section", "message_id", "content_type", "template"]
        for key in keys:
            value = kwargs[key] if key in kwargs else ""
            output_message[key] = value

        return output_message

    except Exception as e:
        print(f"DEBUG: processing error with {e}")
        return {"type": type, "format": format, "content": content}
