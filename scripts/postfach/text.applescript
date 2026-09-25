-- Postfach-Abgleich Lippe Forst: Kopfzeilen und Klartext EINER Mail in eine Datei schreiben.
-- Aufruf: osascript text.applescript <Outlook-ID> /pfad/mail.txt
-- Datei (UTF-8): Kopfzeilen, dann eine Zeile "=====LIPPEFORST-TEXT=====", dann der Klartext.

on run argv
	set mid to (item 1 of argv) as integer
	set ziel to item 2 of argv
	set kopf to ""
	set inhalt to ""
	with timeout of 120 seconds
		tell application "Microsoft Outlook"
			set m to message id mid
			try
				set kopf to headers of m
			end try
			try
				set inhalt to plain text content of m
			end try
		end tell
	end timeout
	if kopf is missing value then set kopf to ""
	if inhalt is missing value then set inhalt to ""
	set fh to open for access (POSIX file ziel) with write permission
	set eof of fh to 0
	write (kopf & linefeed & "=====LIPPEFORST-TEXT=====" & linefeed & inhalt) to fh as «class utf8»
	close access fh
	return "ok"
end run
