-- Postfach-Abgleich Lippe Forst: Kopfdaten der Mails im Anfragenpostfach seit einem Zeitpunkt.
-- Aufruf: osascript scan.applescript "YYYY-MM-DD HH:MM" "info@tr-immobilien.com" /pfad/ausgabe.tsv
-- Ausgabe (UTF-8, eine Zeile je Mail, Tab-getrennt): OUTLOOK-ID  ORDNER  ZEIT  ABSENDER  BETREFF
-- Liest nur das genannte Konto (Posteingang, Archiv, Gelöschte, Junk, „Erneut erinnern“) — keine
-- Inhalte, nur Kopfdaten; den Text holt text.applescript für die wenigen passenden Mails.

on zwei(n)
	return text -2 thru -1 of ("0" & (n as integer))
end zwei

on iso(d)
	return ((year of d) as text) & "-" & my zwei(month of d as integer) & "-" & my zwei(day of d) & " " & my zwei(hours of d) & ":" & my zwei(minutes of d) & ":" & my zwei(seconds of d)
end iso

on alsDatum(s)
	set d to current date
	set day of d to 1
	set year of d to (text 1 thru 4 of s) as integer
	set month of d to (text 6 thru 7 of s) as integer
	set day of d to (text 9 thru 10 of s) as integer
	set time of d to ((text 12 thru 13 of s) as integer) * 3600 + ((text 15 thru 16 of s) as integer) * 60
	return d
end alsDatum

-- Tabs und Zeilenumbrüche aus Betreffs entfernen (sonst zerfällt die Zeile).
on einzeilig(s)
	set alt to AppleScript's text item delimiters
	set AppleScript's text item delimiters to {tab, return, linefeed}
	set teile to text items of s
	set AppleScript's text item delimiters to " "
	set s to teile as text
	set AppleScript's text item delimiters to alt
	return s
end einzeilig

on run argv
	set seit to my alsDatum(item 1 of argv)
	set konto to item 2 of argv
	set ziel to item 3 of argv
	set ordnerNamen to {"Posteingang", "Inbox", "Archiv", "Archive", "Gelöschte Elemente", "Deleted Items", "Junk-E-Mail", "Junk Email", "Erneut erinnern aktiviert"}
	set out to ""
	with timeout of 280 seconds
		tell application "Microsoft Outlook"
			set acc to missing value
			repeat with a in (every exchange account)
				try
					if (email address of a) is konto then set acc to a
				end try
			end repeat
			if acc is missing value then
				repeat with a in (every imap account)
					try
						if (email address of a) is konto then set acc to a
					end try
				end repeat
			end if
			if acc is missing value then error "Konto nicht gefunden: " & konto
			repeat with mf in (mail folders of acc)
				if (name of mf) is in ordnerNamen then
					set fname to name of mf
					set aelter to 0
					set ml to messages of mf
					repeat with m in ml
						try
							set tr to time received of m
							if tr < seit then
								-- Die Liste ist nach Eingang sortiert; ein paar Ausreißer (verschoben, nachsynchronisiert) tolerieren.
								set aelter to aelter + 1
								if aelter > 25 then exit repeat
							else
								set aelter to 0
								set absAdr to ""
								try
									set sx to sender of m
									set absAdr to address of sx
								end try
								set subj to ""
								try
									set subj to subject of m
								end try
								if subj is missing value then set subj to ""
								set out to out & (id of m) & tab & my einzeilig(fname) & tab & my iso(tr) & tab & absAdr & tab & my einzeilig(subj) & linefeed
							end if
						end try
					end repeat
				end if
			end repeat
		end tell
	end timeout
	set fh to open for access (POSIX file ziel) with write permission
	set eof of fh to 0
	write out to fh as «class utf8»
	close access fh
	return "ok"
end run
